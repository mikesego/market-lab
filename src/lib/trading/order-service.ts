import "server-only";

import Decimal from "decimal.js";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditEvents,
  cashLedger,
  fills,
  instruments,
  journalEntries,
  orders,
  portfolios,
  positions,
} from "@/db/schema";
import { marketDataProvider } from "@/lib/market/provider";
import type { Quote } from "@/lib/market/types";
import {
  applyBuyToPosition,
  applySellToPosition,
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

function executionPriceFor(quote: Quote, side: OrderSide) {
  return side === "buy" ? quote.askPrice ?? quote.price : quote.bidPrice ?? quote.price;
}

function canExecuteAtQuote(quote: Quote) {
  return quote.marketState === "open" && !quote.isStale;
}

export async function placeOrder(input: PlaceOrderInput) {
  const symbol = input.symbol.toUpperCase();
  const [instrument] = await db.select().from(instruments).where(eq(instruments.symbol, symbol)).limit(1);
  if (!instrument || !instrument.isTradable) {
    throw new TradingError("NOT_TRADABLE", "That investment is not available in this season.");
  }
  let liveQuotes: Quote[];
  try {
    liveQuotes = await marketDataProvider.getQuotes();
  } catch {
    throw new TradingError("MARKET_DATA_UNAVAILABLE", "Live market data is temporarily unavailable. Your order was not submitted; try again shortly.");
  }
  const quotesBySymbol = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));
  const quote = quotesBySymbol.get(symbol);
  if (!quote) throw new TradingError("QUOTE_UNAVAILABLE", "A live price is not available for that investment right now.");
  const executionPrice = executionPriceFor(quote, input.side);

  return db.transaction(async (tx) => {
    const [portfolio] = await tx
      .select()
      .from(portfolios)
      .where(eq(portfolios.id, input.portfolioId))
      .for("update")
      .limit(1);
    if (!portfolio || portfolio.studentId !== input.studentId || portfolio.gameId !== input.gameId) {
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
      quote: executionPrice,
      cashAvailable: availableCash,
      positionQuantity: availablePosition,
      allowFractional: input.allowFractional,
    });
    if (!validation.ok) throw new TradingError(validation.code, validation.message);

    if (input.side === "buy") {
      const allPositions = await tx
        .select({ instrumentId: positions.instrumentId, symbol: instruments.symbol, quantity: positions.quantity })
        .from(positions)
        .innerJoin(instruments, eq(positions.instrumentId, instruments.id))
        .where(eq(positions.portfolioId, portfolio.id));
      const holdingsValue = allPositions.reduce(
        (total, row) => total.plus(new Decimal(row.quantity).times(quotesBySymbol.get(row.symbol)?.price ?? 0)),
        new Decimal(0),
      );
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

    const shouldFill =
      canExecuteAtQuote(quote) &&
      (input.orderType === "market" ||
        (input.side === "buy" && executionPrice <= Number(input.limitPrice)) ||
        (input.side === "sell" && executionPrice >= Number(input.limitPrice)));
    const status = shouldFill ? "filled" : quote.marketState === "open" ? "open" : "queued";
    const reservedAmount = !shouldFill && input.side === "buy" ? validation.estimatedTotal : new Decimal(0);

    const [order] = await tx
      .insert(orders)
      .values({
        portfolioId: portfolio.id,
        instrumentId: instrument.id,
        clientOrderId: input.clientOrderId,
        side: input.side,
        orderType: input.orderType,
        quantity: input.quantity,
        limitPrice: input.orderType === "limit" ? validation.estimatedPrice.toFixed(6) : null,
        status,
        filledQuantity: shouldFill ? input.quantity : "0",
        reservedAmount: reservedAmount.toFixed(4),
        submittedQuote: quote.price.toFixed(6),
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

    if (!shouldFill) {
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

export async function processEligibleOrdersForPortfolio(portfolioId: string) {
  const pending = await db
    .select({
      id: orders.id,
      symbol: instruments.symbol,
    })
    .from(orders)
    .innerJoin(instruments, eq(orders.instrumentId, instruments.id))
    .where(and(eq(orders.portfolioId, portfolioId), inArray(orders.status, ["queued", "open"])))
    .limit(20);

  const liveQuotes = await marketDataProvider.getQuotes(pending.map((order) => order.symbol));
  const quotesBySymbol = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));

  for (const pendingOrder of pending) {
    const quote = quotesBySymbol.get(pendingOrder.symbol);
    if (!quote || !canExecuteAtQuote(quote)) continue;

    await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, pendingOrder.id)).for("update").limit(1);
      if (!order || !["queued", "open"].includes(order.status)) return;
      const executionPrice = executionPriceFor(quote, order.side as OrderSide);
      const limitReached =
        order.orderType === "market" ||
        (order.side === "buy" && executionPrice <= Number(order.limitPrice)) ||
        (order.side === "sell" && executionPrice >= Number(order.limitPrice));
      if (!limitReached) {
        if (order.status === "queued") await tx.update(orders).set({ status: "open", updatedAt: new Date() }).where(eq(orders.id, order.id));
        return;
      }

      const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.id, order.portfolioId)).for("update").limit(1);
      if (!portfolio) return;
      const [position] = await tx.select().from(positions).where(and(eq(positions.portfolioId, portfolio.id), eq(positions.instrumentId, order.instrumentId))).limit(1);
      const quantity = new Decimal(order.quantity).minus(order.filledQuantity);
      const amount = quantity.times(executionPrice).toDecimalPlaces(4);
      const released = new Decimal(order.reservedAmount);
      const nextReserved = Decimal.max(0, new Decimal(portfolio.reservedCash).minus(released));

      const cashAvailableAtFill = new Decimal(portfolio.cashBalance).minus(nextReserved);
      if (order.side === "buy" && amount.gt(cashAvailableAtFill)) {
        await tx.update(orders).set({ status: "rejected", rejectionCode: "INSUFFICIENT_CASH_AT_FILL", rejectionMessage: "The opening price exceeded available cash.", reservedAmount: "0", updatedAt: new Date() }).where(eq(orders.id, order.id));
        await tx.update(portfolios).set({ reservedCash: nextReserved.toFixed(4), version: portfolio.version + 1, updatedAt: new Date() }).where(eq(portfolios.id, portfolio.id));
        return;
      }
      if (order.side === "sell" && quantity.gt(position?.quantity ?? 0)) {
        await tx.update(orders).set({ status: "rejected", rejectionCode: "INSUFFICIENT_SHARES_AT_FILL", rejectionMessage: "The shares were no longer available.", updatedAt: new Date() }).where(eq(orders.id, order.id));
        return;
      }

      const nextCash = order.side === "buy" ? new Decimal(portfolio.cashBalance).minus(amount) : new Decimal(portfolio.cashBalance).plus(amount);
      let realized = new Decimal(0);
      if (order.side === "buy") {
        const next = applyBuyToPosition({ currentQuantity: position?.quantity ?? 0, currentAverageCost: position?.averageCost ?? 0, fillQuantity: quantity, fillPrice: executionPrice });
        await tx.insert(positions).values({ portfolioId: portfolio.id, instrumentId: order.instrumentId, quantity: next.quantity.toFixed(8), averageCost: next.averageCost.toFixed(6) }).onConflictDoUpdate({ target: [positions.portfolioId, positions.instrumentId], set: { quantity: next.quantity.toFixed(8), averageCost: next.averageCost.toFixed(6), updatedAt: new Date() } });
      } else if (position) {
        const next = applySellToPosition({ currentQuantity: position.quantity, currentAverageCost: position.averageCost, fillQuantity: quantity, fillPrice: executionPrice });
        realized = next.realizedGain;
        await tx.update(positions).set({ quantity: next.quantity.toFixed(8), realizedGain: new Decimal(position.realizedGain).plus(realized).toFixed(4), updatedAt: new Date() }).where(and(eq(positions.portfolioId, portfolio.id), eq(positions.instrumentId, order.instrumentId)));
      }

      await tx.update(portfolios).set({ cashBalance: nextCash.toFixed(4), reservedCash: nextReserved.toFixed(4), realizedGain: new Decimal(portfolio.realizedGain).plus(realized).toFixed(4), version: portfolio.version + 1, updatedAt: new Date() }).where(eq(portfolios.id, portfolio.id));
      await tx.update(orders).set({ status: "filled", filledQuantity: order.quantity, reservedAmount: "0", updatedAt: new Date() }).where(eq(orders.id, order.id));
      const [fill] = await tx.insert(fills).values({ orderId: order.id, portfolioId: portfolio.id, instrumentId: order.instrumentId, quantity: quantity.toFixed(8), price: executionPrice.toFixed(6), providerEventId: `${quote.providerEventId}:${order.id}` }).onConflictDoNothing().returning();
      if (fill) {
        await tx.insert(cashLedger).values({ portfolioId: portfolio.id, eventType: "trade_settlement", amount: (order.side === "buy" ? amount.negated() : amount).toFixed(4), runningBalance: nextCash.toFixed(4), referenceType: "fill", referenceId: fill.id, memo: `${order.side === "buy" ? "Bought" : "Sold"} ${quantity.toFixed()} ${pendingOrder.symbol} at $${executionPrice.toFixed(2)}` });
      }
    });
  }
}

export async function processAllEligibleOrders() {
  const pendingPortfolios = await db
    .selectDistinct({ portfolioId: orders.portfolioId })
    .from(orders)
    .where(inArray(orders.status, ["queued", "open"]))
    .limit(250);

  for (const { portfolioId } of pendingPortfolios) {
    await processEligibleOrdersForPortfolio(portfolioId);
  }

  return { portfoliosChecked: pendingPortfolios.length };
}
