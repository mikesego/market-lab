import "server-only";
import Decimal from "decimal.js";
import { and, eq, gt, gte, inArray, lte } from "drizzle-orm";
import { db, type Database } from "@/db";
import { auditEvents, cashLedger, classroomDevices, corporateActionApplications, corporateActions, orders, portfolios, positions } from "@/db/schema";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Caller holds the portfolio lock. Both cron and device reconciliation use
// this function, so a corporate event cannot race a trade or apply twice.
export async function applyPortfolioCorporateAction(tx: Transaction, action: typeof corporateActions.$inferSelect, portfolio: typeof portfolios.$inferSelect) {
  const [applied] = await tx.select().from(corporateActionApplications).where(and(eq(corporateActionApplications.actionId, action.id), eq(corporateActionApplications.portfolioId, portfolio.id)));
  if (applied) return portfolio;
  const [position] = await tx.select().from(positions).where(and(eq(positions.portfolioId, portfolio.id), eq(positions.instrumentId, action.instrumentId)));
  if (!position || new Decimal(position.quantity).lte(0)) return portfolio;
  let nextCash = new Decimal(portfolio.cashBalance);
  if (action.actionType === "split") {
    if (!action.splitNumerator || !action.splitDenominator) throw new Error("Split ratio is required.");
    const ratio = new Decimal(action.splitNumerator).div(action.splitDenominator);
    await tx.update(positions).set({ quantity: new Decimal(position.quantity).times(ratio).toFixed(8), averageCost: new Decimal(position.averageCost).div(ratio).toFixed(6), updatedAt: new Date() }).where(and(eq(positions.portfolioId, portfolio.id), eq(positions.instrumentId, action.instrumentId)));
    const waiting = await tx.select().from(orders).where(and(eq(orders.portfolioId, portfolio.id), eq(orders.instrumentId, action.instrumentId), inArray(orders.status, ["open", "queued", "partially_filled"])));
    for (const order of waiting) {
      await tx.update(orders).set({ quantity: new Decimal(order.quantity).times(ratio).toFixed(8), filledQuantity: new Decimal(order.filledQuantity).times(ratio).toFixed(8), limitPrice: order.limitPrice ? new Decimal(order.limitPrice).div(ratio).toFixed(6) : null, updatedAt: new Date() }).where(eq(orders.id, order.id));
    }
  } else if (action.actionType === "cash_dividend") {
    if (!action.cashAmountPerShare) throw new Error("Dividend amount is required.");
    const credit = new Decimal(position.quantity).times(action.cashAmountPerShare).toDecimalPlaces(4);
    nextCash = nextCash.plus(credit);
    await tx.insert(cashLedger).values({ portfolioId: portfolio.id, eventType: "cash_dividend", amount: credit.toFixed(4), runningBalance: nextCash.toFixed(4), referenceType: "corporate_action", referenceId: action.id, memo: `Cash dividend: $${action.cashAmountPerShare} per share` });
  } else throw new Error(`Unsupported corporate action: ${action.actionType}`);
  const [updated] = await tx.update(portfolios).set({ cashBalance: nextCash.toFixed(4), version: portfolio.version + 1, updatedAt: new Date() }).where(eq(portfolios.id, portfolio.id)).returning();
  await tx.insert(corporateActionApplications).values({ actionId: action.id, portfolioId: portfolio.id });
  await tx.insert(auditEvents).values({ actorType: "system", action: "portfolio_corporate_action_applied", targetType: "corporate_action", targetId: action.id, gameId: portfolio.gameId, metadata: { portfolioId: portfolio.id, type: action.actionType, providerEventId: action.providerEventId } });
  return updated;
}

export async function pendingDeviceActions(tx: Transaction, device: typeof classroomDevices.$inferSelect) {
  // Include processed global events: an offline buy may only just have arrived.
  const actions = await tx.select({ action: corporateActions }).from(corporateActions).innerJoin(positions, and(eq(positions.instrumentId, corporateActions.instrumentId), eq(positions.portfolioId, device.portfolioId), gt(positions.quantity, "0"))).where(and(gte(corporateActions.effectiveAt, device.createdAt), lte(corporateActions.effectiveAt, new Date()))).orderBy(corporateActions.effectiveAt);
  const applied = await tx.select({ id: corporateActionApplications.actionId }).from(corporateActionApplications).where(eq(corporateActionApplications.portfolioId, device.portfolioId));
  const ids = new Set(applied.map((row) => row.id));
  return actions.map((row) => row.action).filter((action) => !ids.has(action.id));
}

export async function processCorporateAction(actionId: string) {
  const [action] = await db.select().from(corporateActions).where(eq(corporateActions.id, actionId));
  if (!action || action.status === "processed" || action.effectiveAt > new Date()) return;
  const affected = await db.select({ portfolioId: positions.portfolioId }).from(positions).where(and(eq(positions.instrumentId, action.instrumentId), gt(positions.quantity, "0")));
  let deferred = false;
  for (const row of affected) {
    const wasDeferred = await db.transaction(async (tx) => {
      const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.id, row.portfolioId)).for("update");
      if (!portfolio) return false;
      const [device] = await tx.select().from(classroomDevices).where(and(eq(classroomDevices.portfolioId, portfolio.id), eq(classroomDevices.active, true)));
      if (device) return true;
      await applyPortfolioCorporateAction(tx, action, portfolio);
      return false;
    });
    deferred ||= wasDeferred;
  }
  if (!deferred) {
    await db.update(corporateActions).set({ status: "processed", processedAt: new Date() }).where(eq(corporateActions.id, action.id));
  }
}
