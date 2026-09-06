import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { classroomDevices, instruments, portfolios, positions } from "@/db/schema";
import { authenticateDevice, ClassroomError, classroomBody, classroomFailure, classroomResponse, createPricePack } from "@/lib/classroom/server";
import { applyPortfolioCorporateAction, pendingDeviceActions } from "@/lib/trading/corporate-actions";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const input = z.object({ deviceId: z.string().uuid(), lastSequence: z.number().int().nonnegative() }).parse(await classroomBody(request));
    const device = await authenticateDevice(request, input.deviceId);
    const account = await db.transaction(async (tx) => {
      let [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.id, device.portfolioId)).for("update");
      const [current] = await tx.select().from(classroomDevices).where(eq(classroomDevices.id, device.id)).for("update");
      if (!current.active || current.lastSequence !== input.lastSequence || current.portfolioVersion !== portfolio.version) throw new ClassroomError("Sync this tablet’s complete trade history before updating its holdings.");
      for (const action of await pendingDeviceActions(tx, current)) portfolio = await applyPortfolioCorporateAction(tx, action, portfolio);
      await tx.update(classroomDevices).set({ portfolioVersion: portfolio.version }).where(eq(classroomDevices.id, device.id));
      const held = await tx.select({ symbol: instruments.symbol, quantity: positions.quantity, averageCost: positions.averageCost, realizedGain: positions.realizedGain }).from(positions).innerJoin(instruments, eq(positions.instrumentId, instruments.id)).where(eq(positions.portfolioId, portfolio.id));
      return { cash: portfolio.cashBalance, realizedGain: portfolio.realizedGain, positions: Object.fromEntries(held.map(({ symbol, ...position }) => [symbol, position])) };
    });
    // Both balances and a full price pack must reach the tablet together. If
    // market data fails it remains in reconciliation mode and retries safely.
    const pack = await createPricePack(device);
    return classroomResponse({ account, pack });
  } catch (error) { return classroomFailure(error); }
}
