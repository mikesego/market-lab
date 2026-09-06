import type { ClassroomState, ClassroomTrade, PricePack } from "../../src/lib/classroom/model";
export function fixturePack(price = "100.000000", id = "pack-1"): PricePack {
  return {
    id, deviceId: "device-1", fetchedAt: "2026-09-05T12:00:00.000Z",
    rules: { status: "active", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z", allowFractional: true, maxPositionPercent: "30", minCashPercent: "0", rationaleRequired: true },
    assets: { AAPL: { instrumentId: "instrument-1", symbol: "AAPL", name: "Apple", description: "Makes phones and computers.", sector: "Technology", assetType: "stock", fractionable: true, price, asOf: "2026-09-04T20:00:00.000Z", providerEventId: "fixture-quote" } },
  };
}
export function fixtureState(): ClassroomState {
  const pack = fixturePack();
  return { schema: 1, deviceId: "device-1", token: "a".repeat(64), label: "Fire 01", studentId: "student-1", studentName: "Test Fox", gameName: "Offline test", joinCode: "TEST-01", startingCash: "100000.0000", account: { cash: "100000.0000", realizedGain: "0.0000", positions: {} }, pack, packs: { [pack.id]: pack }, trades: [], lastSequence: 0, acknowledgedSequence: 0, lastSyncAt: null, syncError: null, pricesError: null, lessons: [] };
}
export function fixtureTrade(overrides: Partial<ClassroomTrade> = {}): ClassroomTrade {
  return { id: "trade-1", sequence: 1, packId: "pack-1", symbol: "AAPL", side: "buy", quantity: "10", rationale: "I expect customers to keep buying phones.", confidence: 3, executedAt: "2026-09-05T13:00:00.000Z", ...overrides };
}
