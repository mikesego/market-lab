import "server-only";

import Decimal from "decimal.js";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditEvents,
  cashLedger,
  fills,
  games,
  instruments,
  journalEntries,
  orders,
  portfolios,
  positions,
  students,
} from "@/db/schema";
import { syncAlpacaInstrument } from "@/lib/instruments/service";
import { getAlpacaAsset } from "@/lib/market/alpaca-assets";
import { isSupportedStockOrEtf } from "@/lib/market/asset-utils";
import { getUsEquitySession } from "@/lib/market/calendar";
import { marketDataProvider } from "@/lib/market/provider";
import type { Quote } from "@/lib/market/types";
import {
  applyBuyToPosition,
  applySellToPosition,
  evaluateOrderExecution,
  type OrderSide,
  type OrderType,
  validateOrder,
} from "@/lib/trading/calculations";

type PlaceOrderInput = {
  studentId: string;
  gameId: string;
  portfolioId: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: string;
  limitPrice?: string | null;
  rationale: string;
  confidence: number;
  allowFractional: boolean;
  maxPositionPercent: string;
  clientOrderId: string;
};

export class TradingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "TradingError";
  }
}

function referencePriceFor(quote: Quote, side: OrderSide) {
  return side === "buy" ? quote.askPrice ?? quote.price : quote.bidPrice ?? quote.price;
}

export async function placeOrder(input: PlaceOrderInput) {
  const symbol = input.symbol.toUpperCase();
  let asset;
  try {
    asset = await getAlpacaAsset(symbol);
  } catch {
    throw new TradingError("NOT_TRADABLE", "That investment is not available for simulated trading.");
  }
  if (!isSupportedStockOrEtf(asset)) {
    throw new TradingError("NOT_TRADABLE", "That investment is not available in this season.");
  }

  const heldSymbols = await db
    .select({ symbol: instruments.symbol, quantity: positions.quantity })
    .from(positions)
    .innerJoin(instruments, eq(positions.instrumentId, instruments.id))
    .where(eq(positions.portfolioId, input.portfolioId));
  let liveQuotes: Quote[];
  try {
    liveQuotes = await marketDataProvider.getQuotes([
      ...new Set([symbol, ...heldSymbols.filter((row) => new Decimal(row.quantity).gt(0)).map((row) => row.symbol)]),
    ]);
  } catch {
    throw new TradingError("MARKET_DATA_UNAVAILABLE", "Live market data is temporarily unavailable. Your order was not submitted; try again shortly.");
  }
  const quotesBySymbol = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));
  const quote = quotesBySymbol.get(symbol);
  if (!quote) throw new TradingError("QUOTE_UNAVAILABLE", "A live price is not available for that investment right now.");
  const { instrument } = await syncAlpacaInstrument(asset, quote.price);
  if (!instrument?.isTradable) {
    throw new TradingError("NOT_TRADABLE", "That investment is not available for simulated trading.");
  }
  const referencePrice = referencePriceFor(quote, input.side);
  const allowFractional = input.allowFractional && asset.fractionable;

  return db.transaction(async (tx) => {
    const [game] = await tx
      .select({ id: games.id, status: games.status, startsAt: games.startsAt, endsAt: games.endsAt })
      .from(games)
      .where(eq(games.id, input.gameId))
      .for("share")
      .limit(1);
    const now = new Date();
    if (!game || game.status === "archived" || now >= game.endsAt) {
      throw new TradingError("SEASON_ENDED", "This season has ended, so it is no longer accepting orders.");
    }
    if (game.status !== "active") {
      throw new TradingError("SEASON_PAUSED", "Trading is paused for this season.");
    }
    if (now < game.startsAt) {
      throw new TradingError("SEASON_NOT_STARTED", "Trading will be available when this season begins.");
    }

    const [portfolio] = await tx
      .select()
      .from(portfolios)
      .where(eq(portfolios.id, input.portfolioId))
      .for("update")
      .limit(1);
    if (!portfolio || portfolio.studentId !== input.studentId || portfolio.gameId !== input.gameId || portfolio.status !== "active") {
      throw new TradingError("FORBIDDEN", "This portfolio is not available.");
    }

    const [position] = await tx
      .select()
      .from(positions)
      .where(and(eq(positions.portfolioId, portfolio.id), eq(positions.instrumentId, instrument.id)))
      .limit(1);
    const [openSell] = await tx
      .select({ quantity: sql<string>`coalesce(sum(${orders.quantity} - ${orders.filledQuantity}), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.portfolioId, portfolio.id),
          eq(orders.instrumentId, instrument.id),
          eq(orders.side, "sell"),
          inArray(orders.status, ["queued", "open", "partially_filled"]),
        ),
      );
    const availablePosition = new Decimal(position?.quantity ?? 0).minus(openSell?.quantity ?? 0);
    const availableCash = new Decimal(portfolio.cashBalance).minus(portfolio.reservedCash);
    const validation = validateOrder({
      side: input.side,
      orderType: input.orderType,
      quantity: input.quantity,
      limitPrice: input.limitPrice,
      quote: referencePrice,
      cashAvailable: availableCash,
      positionQuantity: availablePosition,
      allowFractional,
    });
    if (!validation.ok) throw new TradingError(validation.code, validation.message);

    if (input.side === "buy") {
      const allPositions = await tx
        .select({ instrumentId: positions.instrumentId, symbol: instruments.symbol, quantity: positions.quantity })
        .from(positions)
        .innerJoin(instruments, eq(positions.instrumentId, instruments.id))
        .where(eq(positions.portfolioId, portfolio.id));
      let holdingsValue = new Decimal(0);
      for (const row of allPositions) {
        if (new Decimal(row.quantity).isZero()) continue;
        const holdingQuote = quotesBySymbol.get(row.symbol);
        if (!holdingQuote) {
          throw new TradingError("MARKET_DATA_UNAVAILABLE", `A live price for ${row.symbol} is unavailable. Your order was not submitted.`);
        }
        holdingsValue = holdingsValue.plus(new Decimal(row.quantity).times(holdingQuote.price));
      }
      const equity = new Decimal(portfolio.cashBalance).plus(holdingsValue);
      const currentValue = new Decimal(position?.quantity ?? 0).times(quote.price);
      const newWeight = currentValue.plus(validation.estimatedTotal).div(equity).times(100);
      if (newWeight.gt(input.maxPositionPercent)) {
        throw new TradingError(
          "POSITION_LIMIT",
          `This would put more than ${Number(input.maxPositionPercent).toFixed(0)}% of your portfolio in one investment.`,
        );
      }
    }

    const execution = evaluateOrderExecution({
      side: input.side,
      orderType: input.orderType,
      limitPrice: input.limitPrice,
      quote,
    });
    const status = execution.shouldFill ? "filled" : quote.marketState === "open" && !quote.isStale ? "open" : "queued";
    const reservedAmount = !execution.shouldFill && input.side === "buy" ? validation.estimatedTotal : new Decimal(0);

    const [order] = await tx
      .insert(orders)
      .values({
        portfolioId: portfolio.id,
        instrumentId: instrument.id,
        clientOrderId: input.clientOrderId,
        side: input.side,
        orderType: input.orderType,
        timeInForce: "gtc",
        quantity: input.quantity,
        limitPrice: input.orderType === "limit" ? validation.estimatedPrice.toFixed(6) : null,
        status,
        filledQuantity: execution.shouldFill ? input.quantity : "0",
        reservedAmount: reservedAmount.toFixed(4),
        submittedQuote: quote.price.toFixed(6),
        expiresAt: game.endsAt,
      })
      .returning();

    await tx.insert(journalEntries).values({
      studentId: input.studentId,
      gameId: input.gameId,
      orderId: order.id,
      prompt: "What do you expect, and what evidence would change your mind?",
      thesis: input.rationale,
      confidence: input.confidence,
      tags: [symbol, input.side],
    });

    if (!execution.shouldFill) {
      if (reservedAmount.gt(0)) {
        await tx
          .update(portfolios)
          .set({
            reservedCash: new Decimal(portfolio.reservedCash).plus(reservedAmount).toFixed(4),
            version: portfolio.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(portfolios.id, portfolio.id));
      }
    } else {
      const executionPrice = execution.executionPrice;
      const quantity = new Decimal(input.quantity);
      const amount = quantity.times(executionPrice).toDecimalPlaces(4);
      const nextCash = input.side === "buy"
        ? new Decimal(portfolio.cashBalance).minus(amount)
        : new Decimal(portfolio.cashBalance).plus(amount);
      const realized = input.side === "sell" && position
        ? applySellToPosition({
            currentQuantity: position.quantity,
            currentAverageCost: position.averageCost,
            fillQuantity: quantity,
            fillPrice: executionPrice,
          }).realizedGain
        : new Decimal(0);
      await tx
        .update(portfolios)
        .set({
          cashBalance: nextCash.toFixed(4),
          realizedGain: new Decimal(portfolio.realizedGain).plus(realized).toFixed(4),
          version: portfolio.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(portfolios.id, portfolio.id));

      if (input.side === "buy") {
        const next = applyBuyToPosition({
          currentQuantity: position?.quantity ?? 0,
          currentAverageCost: position?.averageCost ?? 0,
          fillQuantity: quantity,
          fillPrice: executionPrice,
        });
        await tx
          .insert(positions)
          .values({
            portfolioId: portfolio.id,
            instrumentId: instrument.id,
            quantity: next.quantity.toFixed(8),
            averageCost: next.averageCost.toFixed(6),
          })
          .onConflictDoUpdate({
            target: [positions.portfolioId, positions.instrumentId],
            set: {
              quantity: next.quantity.toFixed(8),
              averageCost: next.averageCost.toFixed(6),
              updatedAt: new Date(),
            },
          });
      } else if (position) {
        const next = applySellToPosition({
          currentQuantity: position.quantity,
          currentAverageCost: position.averageCost,
          fillQuantity: quantity,
          fillPrice: executionPrice,
        });
        await tx
          .update(positions)
          .set({
            quantity: next.quantity.toFixed(8),
            realizedGain: new Decimal(position.realizedGain).plus(next.realizedGain).toFixed(4),
            updatedAt: new Date(),
          })
          .where(and(eq(positions.portfolioId, portfolio.id), eq(positions.instrumentId, instrument.id)));
      }

      const [fill] = await tx
        .insert(fills)
        .values({
          orderId: order.id,
          portfolioId: portfolio.id,
          instrumentId: instrument.id,
          quantity: input.quantity,
          price: executionPrice.toFixed(6),
          providerEventId: `${quote.providerEventId}:${order.id}`,
        })
        .returning();
      await tx.insert(cashLedger).values({
        portfolioId: portfolio.id,
        eventType: "trade_settlement",
        amount: (input.side === "buy" ? amount.negated() : amount).toFixed(4),
        runningBalance: nextCash.toFixed(4),
        referenceType: "fill",
        referenceId: fill.id,
        memo: `${input.side === "buy" ? "Bought" : "Sold"} ${input.quantity} ${symbol} at $${executionPrice.toFixed(2)}`,
      });
      await tx.insert(auditEvents).values({
        actorType: "system",
        action: "order_filled",
        targetType: "order",
        targetId: order.id,
        gameId: input.gameId,
        metadata: {
          symbol,
          side: input.side,
          orderType: input.orderType,
          quantity: input.quantity,
          executionPrice: executionPrice.toFixed(6),
          quoteAsOf: quote.asOf,
          providerEventId: quote.providerEventId,
        },
      });
    }

    await tx.insert(auditEvents).values({
      actorType: "student",
      actorId: input.studentId,
      action: "order_submitted",
      targetType: "order",
      targetId: order.id,
      gameId: input.gameId,
      metadata: { symbol, side: input.side, orderType: input.orderType, status },
    });

    return { orderId: order.id, status, symbol };
  });
}

export async function cancelOrder(input: { orderId: string; studentId: string; portfolioId: string; gameId: string }) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.portfolioId, input.portfolioId)))
      .for("update")
      .limit(1);
    if (!order || !["queued", "open", "partially_filled"].includes(order.status)) {
      throw new TradingError("NOT_CANCELABLE", "This order can no longer be canceled.");
    }
    const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.id, input.portfolioId)).for("update").limit(1);
    if (!portfolio || portfolio.studentId !== input.studentId) throw new TradingError("FORBIDDEN", "This portfolio is not available.");
    const released = new Decimal(order.reservedAmount);
    await tx.update(orders).set({ status: "canceled", canceledAt: new Date(), reservedAmount: "0", updatedAt: new Date() }).where(eq(orders.id, order.id));
    if (released.gt(0)) {
      await tx.update(portfolios).set({ reservedCash: Decimal.max(0, new Decimal(portfolio.reservedCash).minus(released)).toFixed(4), version: portfolio.version + 1, updatedAt: new Date() }).where(eq(portfolios.id, portfolio.id));
    }
    await tx.insert(auditEvents).values({ actorType: "student", actorId: input.studentId, action: "order_canceled", targetType: "order", targetId: order.id, gameId: input.gameId });
    return order.id;
  });
}

const pendingOrderStatuses = ["queued", "open", "partially_filled"];

type PendingOrderCandidate = {
  id: string;
  portfolioId: string;
  symbol: string;
};

type ProcessingOutcome = "filled" | "opened" | "rejected" | "expired" | "waiting" | "skipped";

export type OrderProcessingSummary = {
  ordersChecked: number;
  quotesRequested: number;
  filled: number;
  opened: number;
  rejected: number;
  expired: number;
  waiting: number;
  skipped: number;
};

function createProcessingSummary(): OrderProcessingSummary {
  return {
    ordersChecked: 0,
    quotesRequested: 0,
    filled: 0,
    opened: 0,
    rejected: 0,
    expired: 0,
    waiting: 0,
    skipped: 0,
  };
}

async function getPendingOrderCandidates(portfolioId?: string) {
  return db
    .select({ id: orders.id, portfolioId: orders.portfolioId, symbol: instruments.symbol })
    .from(orders)
    .innerJoin(instruments, eq(orders.instrumentId, instruments.id))
    .where(
      portfolioId
        ? and(eq(orders.portfolioId, portfolioId), inArray(orders.status, pendingOrderStatuses))
        : inArray(orders.status, pendingOrderStatuses),
    )
    .orderBy(asc(orders.updatedAt), asc(orders.submittedAt))
    .limit(250);
}

async function processPendingOrder(
  pendingOrder: PendingOrderCandidate,
  quote: Quote | undefined,
  now: Date,
): Promise<ProcessingOutcome> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, pendingOrder.id))
      .for("update")
      .limit(1);
    if (!order || !pendingOrderStatuses.includes(order.status)) return "skipped";

    const [portfolio] = await tx
      .select()
      .from(portfolios)
      .where(eq(portfolios.id, order.portfolioId))
      .for("update")
      .limit(1);
    if (!portfolio) return "skipped";

    const [game] = await tx
      .select({ id: games.id, status: games.status, startsAt: games.startsAt, endsAt: games.endsAt })
      .from(games)
      .where(eq(games.id, portfolio.gameId))
      .limit(1);
    const [student] = await tx
      .select({ status: students.status })
      .from(students)
      .where(eq(students.id, portfolio.studentId))
      .limit(1);
    if (!game || !student) return "skipped";

    const hasExpired = game.status === "archived" || now >= game.endsAt || (order.expiresAt !== null && now >= order.expiresAt);
    if (hasExpired) {
      const released = new Decimal(order.reservedAmount);
      const nextReserved = Decimal.max(0, new Decimal(portfolio.reservedCash).minus(released));
      await tx
        .update(orders)
        .set({
          status: "expired",
          rejectionCode: "SEASON_ENDED",
          rejectionMessage: "The season ended before this order could fill.",
          reservedAmount: "0",
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
      if (released.gt(0)) {
        await tx
          .update(portfolios)
          .set({ reservedCash: nextReserved.toFixed(4), version: portfolio.version + 1, updatedAt: now })
          .where(eq(portfolios.id, portfolio.id));
      }
      await tx.insert(auditEvents).values({
        actorType: "system",
        action: "order_expired",
        targetType: "order",
        targetId: order.id,
        gameId: game.id,
        metadata: { symbol: pendingOrder.symbol, reason: "season_ended" },
      });
      return "expired";
    }

    if (
      game.status !== "active" ||
      now < game.startsAt ||
      portfolio.status !== "active" ||
      student.status !== "active" ||
      !quote
    ) {
      await tx.update(orders).set({ updatedAt: now }).where(eq(orders.id, order.id));
      return "waiting";
    }

    const execution = evaluateOrderExecution({
      side: order.side as OrderSide,
      orderType: order.orderType as OrderType,
      limitPrice: order.limitPrice,
      quote,
    });
    if (!execution.shouldFill) {
      const shouldOpen = quote.marketState === "open" && !quote.isStale && order.status === "queued";
      await tx
        .update(orders)
        .set({ status: shouldOpen ? "open" : order.status, updatedAt: now })
        .where(eq(orders.id, order.id));
      if (shouldOpen) return "opened";
      return "waiting";
    }

    const executionPrice = execution.executionPrice;
    const [position] = await tx
      .select()
      .from(positions)
      .where(and(eq(positions.portfolioId, portfolio.id), eq(positions.instrumentId, order.instrumentId)))
      .limit(1);
    const quantity = new Decimal(order.quantity).minus(order.filledQuantity);
    const amount = quantity.times(executionPrice).toDecimalPlaces(4);
    const released = new Decimal(order.reservedAmount);
    const nextReserved = Decimal.max(0, new Decimal(portfolio.reservedCash).minus(released));
    const cashAvailableAtFill = new Decimal(portfolio.cashBalance).minus(nextReserved);

    if (order.side === "buy" && amount.gt(cashAvailableAtFill)) {
      await tx
        .update(orders)
        .set({
          status: "rejected",
          rejectionCode: "INSUFFICIENT_CASH_AT_FILL",
          rejectionMessage: "The fill price exceeded the available cash.",
          reservedAmount: "0",
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
      await tx
        .update(portfolios)
        .set({ reservedCash: nextReserved.toFixed(4), version: portfolio.version + 1, updatedAt: now })
        .where(eq(portfolios.id, portfolio.id));
      await tx.insert(auditEvents).values({
        actorType: "system",
        action: "order_rejected",
        targetType: "order",
        targetId: order.id,
        gameId: game.id,
        metadata: { symbol: pendingOrder.symbol, reason: "insufficient_cash_at_fill" },
      });
      return "rejected";
    }
    if (order.side === "sell" && quantity.gt(position?.quantity ?? 0)) {
      await tx
        .update(orders)
        .set({
          status: "rejected",
          rejectionCode: "INSUFFICIENT_SHARES_AT_FILL",
          rejectionMessage: "The shares were no longer available.",
          reservedAmount: "0",
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
      await tx.insert(auditEvents).values({
        actorType: "system",
        action: "order_rejected",
        targetType: "order",
        targetId: order.id,
        gameId: game.id,
        metadata: { symbol: pendingOrder.symbol, reason: "insufficient_shares_at_fill" },
      });
      return "rejected";
    }

    const nextCash = order.side === "buy"
      ? new Decimal(portfolio.cashBalance).minus(amount)
      : new Decimal(portfolio.cashBalance).plus(amount);
    let realized = new Decimal(0);
    if (order.side === "buy") {
      const next = applyBuyToPosition({
        currentQuantity: position?.quantity ?? 0,
        currentAverageCost: position?.averageCost ?? 0,
        fillQuantity: quantity,
        fillPrice: executionPrice,
      });
      await tx
        .insert(positions)
        .values({
          portfolioId: portfolio.id,
          instrumentId: order.instrumentId,
          quantity: next.quantity.toFixed(8),
          averageCost: next.averageCost.toFixed(6),
        })
        .onConflictDoUpdate({
          target: [positions.portfolioId, positions.instrumentId],
          set: {
            quantity: next.quantity.toFixed(8),
            averageCost: next.averageCost.toFixed(6),
            updatedAt: now,
          },
        });
    } else if (position) {
      const next = applySellToPosition({
        currentQuantity: position.quantity,
        currentAverageCost: position.averageCost,
        fillQuantity: quantity,
        fillPrice: executionPrice,
      });
      realized = next.realizedGain;
      await tx
        .update(positions)
        .set({
          quantity: next.quantity.toFixed(8),
          realizedGain: new Decimal(position.realizedGain).plus(realized).toFixed(4),
          updatedAt: now,
        })
        .where(and(eq(positions.portfolioId, portfolio.id), eq(positions.instrumentId, order.instrumentId)));
    }

    await tx
      .update(portfolios)
      .set({
        cashBalance: nextCash.toFixed(4),
        reservedCash: nextReserved.toFixed(4),
        realizedGain: new Decimal(portfolio.realizedGain).plus(realized).toFixed(4),
        version: portfolio.version + 1,
        updatedAt: now,
      })
      .where(eq(portfolios.id, portfolio.id));
    await tx
      .update(orders)
      .set({ status: "filled", filledQuantity: order.quantity, reservedAmount: "0", updatedAt: now })
      .where(eq(orders.id, order.id));
    const [fill] = await tx
      .insert(fills)
      .values({
        orderId: order.id,
        portfolioId: portfolio.id,
        instrumentId: order.instrumentId,
        quantity: quantity.toFixed(8),
        price: executionPrice.toFixed(6),
        providerEventId: `${quote.providerEventId}:${order.id}`,
        executedAt: now,
      })
      .returning();
    await tx.insert(cashLedger).values({
      portfolioId: portfolio.id,
      eventType: "trade_settlement",
      amount: (order.side === "buy" ? amount.negated() : amount).toFixed(4),
      runningBalance: nextCash.toFixed(4),
      referenceType: "fill",
      referenceId: fill.id,
      memo: `${order.side === "buy" ? "Bought" : "Sold"} ${quantity.toFixed()} ${pendingOrder.symbol} at $${executionPrice.toFixed(2)}`,
      occurredAt: now,
    });
    await tx.insert(auditEvents).values({
      actorType: "system",
      action: "order_filled",
      targetType: "order",
      targetId: order.id,
      gameId: game.id,
      metadata: {
        symbol: pendingOrder.symbol,
        side: order.side,
        orderType: order.orderType,
        quantity: quantity.toFixed(8),
        executionPrice: executionPrice.toFixed(6),
        quoteAsOf: quote.asOf,
        providerEventId: quote.providerEventId,
      },
    });
    return "filled";
  });
}

async function processCandidates(candidates: PendingOrderCandidate[]) {
  const summary = createProcessingSummary();
  summary.ordersChecked = candidates.length;
  if (!candidates.length) return summary;

  const uniqueSymbols = [...new Set(candidates.map((order) => order.symbol))];
  let quotesBySymbol = new Map<string, Quote>();
  if (candidates.length && uniqueSymbols.length) {
    const sessionOpen = candidates.length > 0 && getUsEquitySession().state === "open";
    if (sessionOpen) {
      const liveQuotes = await marketDataProvider.getQuotes(uniqueSymbols);
      quotesBySymbol = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));
      summary.quotesRequested = uniqueSymbols.length;
    }
  }

  for (const candidate of candidates) {
    const outcome = await processPendingOrder(candidate, quotesBySymbol.get(candidate.symbol), new Date());
    summary[outcome] += 1;
  }
  return summary;
}

export async function processEligibleOrdersForPortfolio(portfolioId: string) {
  return processCandidates(await getPendingOrderCandidates(portfolioId));
}

export async function processAllEligibleOrders() {
  const candidates = await getPendingOrderCandidates();
  return {
    portfoliosChecked: new Set(candidates.map((order) => order.portfolioId)).size,
    ...(await processCandidates(candidates)),
  };
}
