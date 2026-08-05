import "server-only";

import Decimal from "decimal.js";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { auditEvents, cashLedger, corporateActions, orders, portfolios, positions } from "@/db/schema";
import type { Database } from "@/db";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function applySplit(tx: Transaction, action: typeof corporateActions.$inferSelect) {
  if (!action.splitNumerator || !action.splitDenominator) throw new Error("Split ratio is required.");
  const ratio = new Decimal(action.splitNumerator).div(action.splitDenominator);
  const affectedPositions = await tx.select().from(positions).where(eq(positions.instrumentId, action.instrumentId));
  for (const position of affectedPositions) {
    await tx.update(positions).set({
      quantity: new Decimal(position.quantity).times(ratio).toDecimalPlaces(8).toFixed(8),
      averageCost: new Decimal(position.averageCost).div(ratio).toDecimalPlaces(6).toFixed(6),
      updatedAt: new Date(),
    }).where(and(eq(positions.portfolioId, position.portfolioId), eq(positions.instrumentId, position.instrumentId)));
  }
  const openOrders = await tx.select().from(orders).where(and(eq(orders.instrumentId, action.instrumentId), inArray(orders.status, ["open", "queued", "partially_filled"])));
  for (const order of openOrders) {
    await tx.update(orders).set({
      quantity: new Decimal(order.quantity).times(ratio).toDecimalPlaces(8).toFixed(8),
      limitPrice: order.limitPrice ? new Decimal(order.limitPrice).div(ratio).toDecimalPlaces(6).toFixed(6) : null,
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id));
  }
}

async function applyCashDividend(tx: Transaction, action: typeof corporateActions.$inferSelect) {
  if (!action.cashAmountPerShare) throw new Error("Cash amount is required.");
  const affectedPositions = await tx.select().from(positions).where(eq(positions.instrumentId, action.instrumentId));
  for (const position of affectedPositions) {
    const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.id, position.portfolioId)).for("update").limit(1);
    if (!portfolio) continue;
    const credit = new Decimal(position.quantity).times(action.cashAmountPerShare).toDecimalPlaces(4);
    const nextCash = new Decimal(portfolio.cashBalance).plus(credit);
    await tx.update(portfolios).set({ cashBalance: nextCash.toFixed(4), version: portfolio.version + 1, updatedAt: new Date() }).where(eq(portfolios.id, portfolio.id));
    await tx.insert(cashLedger).values({ portfolioId: portfolio.id, eventType: "cash_dividend", amount: credit.toFixed(4), runningBalance: nextCash.toFixed(4), referenceType: "corporate_action", referenceId: action.id, memo: `Cash dividend: $${new Decimal(action.cashAmountPerShare).toFixed(4)} per share` });
  }
}

export async function processCorporateAction(actionId: string) {
  await db.transaction(async (tx) => {
    const [action] = await tx.select().from(corporateActions).where(eq(corporateActions.id, actionId)).for("update").limit(1);
    if (!action || action.status === "processed") return;
    if (action.actionType === "split") await applySplit(tx, action);
    else if (action.actionType === "cash_dividend") await applyCashDividend(tx, action);
    else throw new Error(`Unsupported corporate action: ${action.actionType}`);
    await tx.update(corporateActions).set({ status: "processed", processedAt: new Date() }).where(eq(corporateActions.id, action.id));
    await tx.insert(auditEvents).values({ actorType: "system", action: "corporate_action_processed", targetType: "corporate_action", targetId: action.id, metadata: { type: action.actionType, providerEventId: action.providerEventId } });
  });
}
