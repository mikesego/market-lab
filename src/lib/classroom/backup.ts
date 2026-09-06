import { z } from "zod";
import type { ClassroomState } from "./model";

const decimal = z.string().regex(/^-?\d{1,18}(\.\d{1,8})?$/);
const nonnegative = decimal.refine((value) => Number(value) >= 0);
const date = z.string().datetime();
const uuid = z.string().uuid();
const asset = z.object({ instrumentId: uuid, symbol: z.string().max(15), name: z.string().max(300), description: z.string().max(5000), sector: z.string().max(200), assetType: z.string().max(30), fractionable: z.boolean(), price: nonnegative.refine((value) => Number(value) > 0), asOf: date, providerEventId: z.string().max(500) });
const pack = z.object({ id: uuid, deviceId: uuid, fetchedAt: date, assets: z.record(z.string().max(15), asset), rules: z.object({ status: z.string().max(30), startsAt: date, endsAt: date, allowFractional: z.boolean(), maxPositionPercent: nonnegative, minCashPercent: nonnegative, rationaleRequired: z.boolean() }) });
const receipt = z.object({ id: uuid, sequence: z.number().int().positive(), packId: uuid, symbol: z.string().max(15), side: z.enum(["buy", "sell"]), quantity: nonnegative, rationale: z.string().max(600), confidence: z.number().int().min(1).max(5), executedAt: date, price: nonnegative, asOf: date, amount: nonnegative });
const backup = z.object({
  schema: z.literal(1), releasing: z.boolean().optional(), reconciling: z.boolean().optional(), deviceId: uuid, token: z.string().regex(/^[a-f0-9]{64}$/), label: z.string().max(40), studentId: uuid, studentName: z.string().max(100), gameName: z.string().max(300), joinCode: z.string().max(20), startingCash: nonnegative,
  account: z.object({ cash: nonnegative, realizedGain: decimal, positions: z.record(z.string().max(15), z.object({ quantity: nonnegative, averageCost: nonnegative, realizedGain: decimal })) }),
  pack, packs: z.record(uuid, pack), trades: z.array(receipt).max(100_000), lastSequence: z.number().int().nonnegative(), acknowledgedSequence: z.number().int().nonnegative(), lastSyncAt: date.nullable(), syncError: z.string().max(2000).nullable(), pricesError: z.string().max(2000).nullable(), lessons: z.array(z.object({ id: z.string().max(100), title: z.string().max(300), summary: z.string().max(5000), content: z.record(z.string(), z.unknown()) })).max(100),
});

export function parseClassroomBackup(input: unknown): ClassroomState {
  const result = backup.safeParse(input);
  if (!result.success) throw new Error("This file is not a supported Market Lab classroom backup.");
  const state = result.data;
  if (state.pack.deviceId !== state.deviceId || !state.packs[state.pack.id] || state.acknowledgedSequence > state.lastSequence || state.trades.length !== state.lastSequence) throw new Error("This backup is incomplete. Use the latest complete backup from the tablet.");
  for (let index = 0; index < state.trades.length; index++) {
    const trade = state.trades[index];
    if (trade.sequence !== index + 1 || (trade.sequence > state.acknowledgedSequence && !state.packs[trade.packId])) throw new Error("The backup is missing trades or their saved prices.");
  }
  for (const [symbol, position] of Object.entries(state.account.positions)) {
    if (Number(position.quantity) > 0 && !state.pack.assets[symbol]) throw new Error("The backup is missing a holding’s saved price.");
  }
  return state;
}
