import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, cashLedger, classroomDevices, classroomPricePacks, fills, games, instruments, journalEntries, lessons, orders, portfolios, positions, students } from "@/db/schema";
import { getStudentSession } from "@/lib/auth/student-session";
import { hashSessionToken } from "@/lib/security/student-credentials";
import { marketDataProvider } from "@/lib/market/provider";
import { MARKET_CATALOG } from "@/lib/market/catalog";
import { getAlpacaAsset } from "@/lib/market/alpaca-assets";
import { isSupportedStockOrEtf } from "@/lib/market/asset-utils";
import { syncAlpacaInstrument } from "@/lib/instruments/service";
import { pendingDeviceActions } from "@/lib/trading/corporate-actions";
import { getEnabledLessonIds } from "@/lib/learning/config";
import { applyClassroomTrade, type ClassroomAccount, type ClassroomState, type PricePack } from "./model";

export class ClassroomError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export const deviceSchema = z.object({ deviceId: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/), label: z.string().trim().min(1).max(40) });
export const tradeSchema = z.object({
  id: z.string().uuid(), sequence: z.number().int().positive().max(2_000_000_000), packId: z.string().uuid(),
  symbol: z.string().regex(/^[A-Z0-9][A-Z0-9.-]{0,14}$/), side: z.enum(["buy", "sell"]),
  quantity: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/), rationale: z.string().max(600),
  confidence: z.number().int().min(1).max(5), executedAt: z.string().datetime(),
});
export const syncSchema = z.object({ deviceId: z.string().uuid(), trades: z.array(tradeSchema).max(100) });

export async function classroomBody(request: Request) {
  // JSON + same-origin requests only. Device endpoints additionally require the
  // scoped bearer; setup requires the ordinary student HttpOnly session cookie.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ClassroomError("Use Market Lab on its own website.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ClassroomError("Expected JSON.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 160_000) throw new ClassroomError("Upload is too large.", 413);
  const text = await request.text();
  if (text.length > 160_000) throw new ClassroomError("Upload is too large.", 413);
  try { return JSON.parse(text) as unknown; } catch { throw new ClassroomError("Invalid upload.", 400); }
}
export function classroomResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function classroomFailure(error: unknown) {
  if (error instanceof ClassroomError) return classroomResponse({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return classroomResponse({ error: "Check the device and trade details." }, 400);
  console.error("Classroom request failed", error instanceof Error ? error.name : "unknown");
  return classroomResponse({ error: "The connection to Market Lab is unavailable. Your saved trades will retry automatically." }, 503);
}
export async function authenticateDevice(request: Request, deviceId: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new ClassroomError("This device needs to be reconnected by your teacher. Keep its saved work.", 401);
  const [device] = await db.select().from(classroomDevices).where(and(eq(classroomDevices.id, deviceId), eq(classroomDevices.tokenHash, hashSessionToken(token)), eq(classroomDevices.active, true))).limit(1);
  if (!device) throw new ClassroomError("This device is no longer assigned. Keep its saved work and ask your teacher for help.", 401);
  return device;
}

async function accountFor(portfolio: typeof portfolios.$inferSelect): Promise<ClassroomAccount> {
  const held = await db.select({ symbol: instruments.symbol, quantity: positions.quantity, averageCost: positions.averageCost, realizedGain: positions.realizedGain }).from(positions).innerJoin(instruments, eq(positions.instrumentId, instruments.id)).where(eq(positions.portfolioId, portfolio.id));
  return { cash: portfolio.cashBalance, realizedGain: portfolio.realizedGain, positions: Object.fromEntries(held.map(({ symbol, ...position }) => [symbol, position])) };
}

export async function createPricePack(device: typeof classroomDevices.$inferSelect, additionalSymbols: string[] = []) {
  const [context] = await db.select({ game: games, student: students }).from(portfolios).innerJoin(games, eq(portfolios.gameId, games.id)).innerJoin(students, eq(portfolios.studentId, students.id)).where(eq(portfolios.id, device.portfolioId));
  if (!context) throw new ClassroomError("Portfolio unavailable.", 404);
  const prior = await db.select().from(classroomPricePacks).where(eq(classroomPricePacks.deviceId, device.id)).orderBy(desc(classroomPricePacks.createdAt)).limit(1);
  const previous = prior[0]?.payload;
  const held = await db.select({ symbol: instruments.symbol }).from(positions).innerJoin(instruments, eq(positions.instrumentId, instruments.id)).where(and(eq(positions.portfolioId, device.portfolioId), gt(positions.quantity, "0")));
  const symbols = [...new Set([...MARKET_CATALOG.map((asset) => asset.symbol), ...held.map((p) => p.symbol), ...Object.keys(previous?.assets ?? {}), ...additionalSymbols])];
  if (symbols.length > 100) throw new ClassroomError("This tablet supports up to 100 downloaded investments.");
  // A failed/partial download leaves the entire previous pack in place. No
  // guessed/base prices, and no new pack claims a failed download succeeded.
  const quotes = await marketDataProvider.getQuotes(symbols);
  const assets: PricePack["assets"] = {};
  await Promise.all(symbols.map(async (symbol) => {
    const quote = quotes.find((q) => q.symbol === symbol);
    if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) throw new ClassroomError(`Could not download a price for ${symbol}. Keep using your saved prices.`, 503);
    const asset = await getAlpacaAsset(symbol);
    if (!isSupportedStockOrEtf(asset)) throw new ClassroomError(`${symbol} is not an available stock or ETF.`, 422);
    const { instrument, profile } = await syncAlpacaInstrument(asset, quote.price);
    // Prevent out-of-order market responses from replacing a newer source price.
    const old = previous?.assets[symbol];
    const selected = old && Date.parse(old.asOf) > Date.parse(quote.asOf) ? old : { price: quote.price.toFixed(6), asOf: quote.asOf, providerEventId: quote.providerEventId };
    assets[symbol] = { instrumentId: instrument.id, symbol, name: profile.name, description: profile.description, sector: profile.sector, assetType: profile.assetType, fractionable: asset.fractionable, ...selected };
  }));
  const game = context.game;
  const pack: PricePack = { id: randomUUID(), deviceId: device.id, fetchedAt: new Date().toISOString(), assets,
    rules: { status: context.student.status === "active" ? game.status : "paused", startsAt: game.startsAt.toISOString(), endsAt: game.endsAt.toISOString(), allowFractional: game.allowFractional, maxPositionPercent: game.maxPositionPercent, minCashPercent: game.minCashPercent, rationaleRequired: game.config.rationaleRequired !== false } };
  await db.transaction(async (tx) => {
    // Match the same lock order as setup/sync/regular trading.
    await tx.select().from(portfolios).where(eq(portfolios.id, device.portfolioId)).for("update");
    const [active] = await tx.select().from(classroomDevices).where(eq(classroomDevices.id, device.id)).for("update");
    if (!active?.active) throw new ClassroomError("This device has been released.", 401);
    if ((await pendingDeviceActions(tx, active)).length) throw new ClassroomError("Sync to reconcile a stock split or dividend before refreshing prices.");
    await tx.insert(classroomPricePacks).values({ id: pack.id, deviceId: device.id, payload: pack });
    await tx.update(classroomDevices).set({ pricesRefreshedAt: new Date(pack.fetchedAt) }).where(eq(classroomDevices.id, device.id));
  });
  return pack;
}

export async function setupDevice(input: z.infer<typeof deviceSchema>) {
  const session = await getStudentSession();
  if (!session) throw new ClassroomError("Sign in as this student while online, then return here to prepare the tablet.", 401);
  const tokenHash = hashSessionToken(input.token);
  const device = await db.transaction(async (tx) => {
    const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.id, session.portfolioId)).for("update");
    if (!portfolio || portfolio.status !== "active") throw new ClassroomError("This portfolio is unavailable.");
    const [existing] = await tx.select().from(classroomDevices).where(and(eq(classroomDevices.portfolioId, portfolio.id), eq(classroomDevices.active, true)));
    if (existing) {
      if (existing.id === input.deviceId && existing.tokenHash === tokenHash) return existing;
      throw new ClassroomError("This student already has an assigned tablet. Sync and release that tablet before switching devices.");
    }
    const pending = await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.portfolioId, portfolio.id), inArray(orders.status, ["pending", "queued", "open", "partially_filled"])));
    if (pending.length || Number(portfolio.reservedCash) !== 0) throw new ClassroomError("Cancel this student’s waiting orders in the online Orders page before preparing the tablet.");
    const [created] = await tx.insert(classroomDevices).values({ id: input.deviceId, tokenHash, label: input.label, portfolioId: portfolio.id, portfolioVersion: portfolio.version }).returning();
    await tx.insert(auditEvents).values({ actorType: "student", actorId: session.studentId, action: "classroom_device_assigned", targetType: "classroom_device", targetId: created.id, gameId: session.gameId, metadata: { label: input.label } });
    return created;
  });
  const pack = await createPricePack(device);
  const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, device.portfolioId));
  if (device.lastSequence > 0) throw new ClassroomError("This device has existing trades. Restore its classroom backup instead of replacing its saved state.");
  const allLessons = await db.select({ id: lessons.id, title: lessons.title, summary: lessons.summary, content: lessons.content }).from(lessons).orderBy(asc(lessons.position));
  const enabledIds = getEnabledLessonIds(session.gameConfig, allLessons.map((lesson) => lesson.id));
  const lessonRows = allLessons.filter((lesson) => enabledIds.has(lesson.id));
  const state: ClassroomState = { schema: 1, deviceId: device.id, token: input.token, label: device.label, studentId: session.studentId, studentName: session.displayName, gameName: session.gameName, joinCode: session.joinCode, startingCash: session.startingCash, account: await accountFor(portfolio), pack, packs: { [pack.id]: pack }, trades: [], lastSequence: 0, acknowledgedSequence: 0, lastSyncAt: null, syncError: null, pricesError: null, lessons: lessonRows };
  return state;
}

export async function syncDevice(device: typeof classroomDevices.$inferSelect, input: z.infer<typeof syncSchema>) {
  return db.transaction(async (tx) => {
    const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.id, device.portfolioId)).for("update");
    const [current] = await tx.select().from(classroomDevices).where(eq(classroomDevices.id, device.id)).for("update");
    if (!current?.active) throw new ClassroomError("This device is no longer assigned.", 401);
    if (portfolio.version !== current.portfolioVersion) throw new ClassroomError("Your portfolio changed outside this tablet. Keep your saved work and ask your teacher to reconcile it.");
    const held = await tx.select({ symbol: instruments.symbol, quantity: positions.quantity, averageCost: positions.averageCost, realizedGain: positions.realizedGain }).from(positions).innerJoin(instruments, eq(positions.instrumentId, instruments.id)).where(eq(positions.portfolioId, portfolio.id));
    let account: ClassroomAccount = { cash: portfolio.cashBalance, realizedGain: portfolio.realizedGain, positions: Object.fromEntries(held.map(({ symbol, ...p }) => [symbol, p])) };
    let sequence = current.lastSequence;
    let version = portfolio.version;
    for (const trade of input.trades) {
      const receiptHash = createHash("sha256").update(JSON.stringify(trade)).digest("hex");
      const clientOrderId = `classroom:${device.id}:${trade.sequence}`;
      if (trade.sequence <= sequence) {
        const [saved] = await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.portfolioId, portfolio.id), eq(orders.clientOrderId, clientOrderId)));
        const [audit] = saved ? await tx.select({ metadata: auditEvents.metadata }).from(auditEvents).where(and(eq(auditEvents.targetId, saved.id), eq(auditEvents.action, "classroom_trade_synced"))).limit(1) : [];
        if (!saved || saved.id !== trade.id || audit?.metadata.receiptHash !== receiptHash) throw new ClassroomError("A trade sequence conflicts with the server record. Keep your backup and ask your teacher for help.");
        continue;
      }
      if (trade.sequence !== sequence + 1) throw new ClassroomError("A saved trade is missing. Restore the tablet’s complete backup before syncing.");
      const [packRecord] = await tx.select().from(classroomPricePacks).where(and(eq(classroomPricePacks.id, trade.packId), eq(classroomPricePacks.deviceId, current.id)));
      if (!packRecord) throw new ClassroomError("The original saved prices for this trade are missing.");
      if (Date.parse(trade.executedAt) > Date.now() + 300_000) throw new ClassroomError("This tablet’s clock is ahead. Correct its date and time, then sync again.");
      let result;
      try { result = applyClassroomTrade(account, packRecord.payload, trade); }
      catch (error) { throw new ClassroomError(error instanceof Error ? error.message : "Trade could not be reconciled."); }
      const asset = packRecord.payload.assets[trade.symbol];
      account = result.account;
      const executedAt = new Date(trade.executedAt);
      await tx.insert(orders).values({ id: trade.id, portfolioId: portfolio.id, instrumentId: asset.instrumentId, clientOrderId, side: trade.side, orderType: "classroom", timeInForce: "ioc", quantity: trade.quantity, status: "filled", filledQuantity: trade.quantity, submittedQuote: asset.price, submittedAt: executedAt });
      const [fill] = await tx.insert(fills).values({ orderId: trade.id, portfolioId: portfolio.id, instrumentId: asset.instrumentId, quantity: trade.quantity, price: asset.price, providerEventId: `classroom:${device.id}:${trade.id}`, executedAt }).returning();
      await tx.insert(cashLedger).values({ portfolioId: portfolio.id, eventType: "trade_settlement", amount: `${trade.side === "buy" ? "-" : ""}${result.receipt.amount}`, runningBalance: account.cash, referenceType: "fill", referenceId: fill.id, memo: `Classroom ${trade.side}: ${trade.quantity} ${trade.symbol} at $${asset.price} (price as of ${asset.asOf})`, occurredAt: executedAt });
      await tx.insert(journalEntries).values({ studentId: portfolio.studentId, gameId: portfolio.gameId, orderId: trade.id, prompt: "Why does this decision make sense?", thesis: trade.rationale || "Rationale was optional for this season.", confidence: trade.confidence, tags: [trade.symbol, trade.side, "classroom"], createdAt: executedAt });
      await tx.insert(positions).values({ portfolioId: portfolio.id, instrumentId: asset.instrumentId, ...account.positions[trade.symbol] }).onConflictDoUpdate({ target: [positions.portfolioId, positions.instrumentId], set: { ...account.positions[trade.symbol], updatedAt: new Date() } });
      await tx.insert(auditEvents).values({ actorType: "student", actorId: portfolio.studentId, action: "classroom_trade_synced", targetType: "order", targetId: trade.id, gameId: portfolio.gameId, metadata: { receiptHash, deviceId: device.id, sequence: trade.sequence, pricePackId: trade.packId, price: asset.price, quoteAsOf: asset.asOf, executedAt: trade.executedAt, syncedAt: new Date().toISOString() } });
      sequence = trade.sequence;
      version += 1;
    }
    const syncedAt = new Date();
    await tx.update(portfolios).set({ cashBalance: account.cash, realizedGain: account.realizedGain, version, updatedAt: syncedAt }).where(eq(portfolios.id, portfolio.id));
    await tx.update(classroomDevices).set({ lastSequence: sequence, portfolioVersion: version, lastSyncAt: syncedAt }).where(eq(classroomDevices.id, device.id));
    const adjustmentsPending = (await pendingDeviceActions(tx, current)).length > 0;
    return { adjustmentsPending, acknowledgedSequence: sequence, syncedAt: syncedAt.toISOString(), refreshRequestedAt: current.refreshRequestedAt?.toISOString() ?? null };
  });
}
