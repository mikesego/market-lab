import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountEquity, applyClassroomTrade } from "../../src/lib/classroom/model";
import { changeState, changeStore, installPack, readState, saveTrade } from "../../src/lib/classroom/store";
import { syncClassroom } from "../../src/lib/classroom/sync";
import { fixturePack, fixtureState, fixtureTrade } from "../fixtures/classroom";

beforeEach(async () => {
  await changeState(() => fixtureState());
  await changeStore("syncLease", () => undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("immediate last-known-price accounting", () => {
  it("buys and sells on a weekend with an old quote and preserves original execution prices", () => {
    const state = fixtureState();
    const bought = applyClassroomTrade(state.account, state.pack, fixtureTrade());
    expect(bought.account.cash).toBe("99000.0000");
    expect(bought.account.positions.AAPL.quantity).toBe("10.00000000");
    const sold = applyClassroomTrade(bought.account, state.pack, fixtureTrade({ id: "sell", side: "sell", quantity: "4" }));
    expect(sold.account.cash).toBe("99400.0000");
    expect(sold.account.positions.AAPL.quantity).toBe("6.00000000");
    const pack = fixturePack("120.000000", "pack-2");
    expect(accountEquity(sold.account, pack).toFixed(4)).toBe("100120.0000");
    const next = applyClassroomTrade(sold.account, pack, fixtureTrade({ packId: pack.id, side: "sell", quantity: "6" }));
    expect(next.receipt.price).toBe("120.000000");
    expect(next.account.cash).toBe("100120.0000");
    expect(next.account.realizedGain).toBe("120.0000");
    expect(bought.receipt.price).toBe("100.000000");
  });
  it.each(["0", "-1", "NaN", "Infinity", "0.0000001", "1000000000"])("rejects invalid/excessive quantity %s", (quantity) => {
    expect(() => applyClassroomTrade(fixtureState().account, fixturePack(), fixtureTrade({ quantity }))).toThrow();
  });
  it("enforces cash, shares, fractional and concentration rules", () => {
    const state = fixtureState();
    expect(() => applyClassroomTrade(state.account, state.pack, fixtureTrade({ side: "sell" }))).toThrow("more shares");
    expect(() => applyClassroomTrade({ ...state.account, cash: "1" }, state.pack, fixtureTrade())).toThrow("cash");
    expect(() => applyClassroomTrade(state.account, state.pack, fixtureTrade({ quantity: "301" }))).toThrow("30%");
    state.pack.rules.allowFractional = false;
    expect(() => applyClassroomTrade(state.account, state.pack, fixtureTrade({ quantity: "0.5" }))).toThrow("whole shares");
  });
  it("requires known prices, a rationale, correct dates, and saved active season rules", () => {
    const state = fixtureState();
    expect(() => applyClassroomTrade(state.account, state.pack, fixtureTrade({ symbol: "UNKNOWN" }))).toThrow("price");
    expect(() => applyClassroomTrade(state.account, state.pack, fixtureTrade({ rationale: "a" }))).toThrow("reason");
    expect(() => applyClassroomTrade(state.account, state.pack, fixtureTrade({ executedAt: "2100-01-01T00:00:00.000Z" }))).toThrow("ended");
    state.pack.rules.status = "paused";
    expect(() => applyClassroomTrade(state.account, state.pack, fixtureTrade())).toThrow("paused");
  });
  it("applies the minimum cash guardrail and decimal rounding", () => {
    const state = fixtureState(); state.pack.rules.minCashPercent = "99.9";
    expect(() => applyClassroomTrade(state.account, state.pack, fixtureTrade())).toThrow("99.9%");
    const pack = fixturePack("1.234567");
    const result = applyClassroomTrade(state.account, pack, fixtureTrade({ quantity: "0.123456" }));
    expect(result.receipt.amount).toBe("0.1524");
    expect(result.account.cash).toBe("99999.8476");
  });
});

describe("durable storage and synchronization", () => {
  const input = { symbol: "AAPL", side: "buy" as const, quantity: "1", rationale: "I expect customers to keep buying phones.", confidence: 3 };
  it("serializes simultaneous tabs and keeps portfolio and receipt atomic", async () => {
    await Promise.all([saveTrade(input, "pack-1"), saveTrade(input, "pack-1")]);
    const state = (await readState())!;
    expect(state.account.cash).toBe("99800.0000");
    expect(state.trades.map((t) => t.sequence)).toEqual([1, 2]);
    expect(state.account.positions.AAPL.quantity).toBe("2.00000000");
  });
  it("aborts without changing cash or receipts if validation fails", async () => {
    await expect(saveTrade({ ...input, quantity: "100000" }, "pack-1")).rejects.toThrow();
    expect((await readState())!.trades).toHaveLength(0);
    expect((await readState())!.account.cash).toBe("100000.0000");
  });
  it("requires re-review if a new pack arrived while the ticket was open", async () => {
    await changeState((state) => installPack(state!, fixturePack("110", "pack-2")));
    await expect(saveTrade(input, "pack-1")).rejects.toThrow("Prices just refreshed");
  });
  it("normalizes fractional quantity for server receipt validation", async () => {
    const state = await saveTrade({ ...input, quantity: ".5" }, "pack-1");
    expect(state!.trades[0].quantity).toBe("0.5");
  });
  it("keeps a receipt after a lost acknowledgement and safely retries it", async () => {
    await saveTrade(input, "pack-1");
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("connection lost")).mockResolvedValueOnce(Response.json({ acknowledgedSequence: 1, syncedAt: new Date().toISOString() }));
    vi.stubGlobal("fetch", fetch);
    await expect(syncClassroom()).rejects.toThrow();
    expect((await readState())!.acknowledgedSequence).toBe(0);
    await syncClassroom();
    expect((await readState())!.acknowledgedSequence).toBe(1);
    expect((await readState())!.account.cash).toBe("99900.0000");
    expect(JSON.parse(fetch.mock.calls[0][1].body).trades[0].id).toBe(JSON.parse(fetch.mock.calls[1][1].body).trades[0].id);
  });
  it("preserves trades submitted while an upload is in flight", async () => {
    await saveTrade(input, "pack-1");
    let release!: (r: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; })).mockResolvedValue(Response.json({ acknowledgedSequence: 2, syncedAt: new Date().toISOString() }));
    vi.stubGlobal("fetch", fetch);
    const sync = syncClassroom();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await saveTrade(input, "pack-1");
    release(Response.json({ acknowledgedSequence: 1, syncedAt: new Date().toISOString() }));
    await sync;
    expect((await readState())!.lastSequence).toBe(2);
    expect((await readState())!.acknowledgedSequence).toBe(2);
    expect((await readState())!.account.cash).toBe("99800.0000");
  });
  it("continues trading on a provider failure after a successful backup", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ acknowledgedSequence: 0, syncedAt: new Date().toISOString() })).mockResolvedValueOnce(Response.json({ error: "Price provider unavailable" }, { status: 503 })));
    await syncClassroom({ refresh: true });
    expect((await readState())!.pack.id).toBe("pack-1");
    expect((await readState())!.syncError).toBeNull();
    expect((await readState())!.pricesError).toBe("Price provider unavailable");
    await expect(saveTrade(input, "pack-1")).resolves.toBeDefined();
  });
  it("retains recoverable work and stops further trades on an accounting conflict", async () => {
    await saveTrade(input, "pack-1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Account conflict" }, { status: 409 })));
    await expect(syncClassroom()).rejects.toThrow("Account conflict");
    const state = (await readState())!;
    expect(state.trades).toHaveLength(1);
    expect(state.acknowledgedSequence).toBe(0);
    await expect(saveTrade(input, "pack-1")).rejects.toThrow("Resolve the sync issue");
  });
  it("does not replace newer price downloads with late older responses", () => {
    const state = fixtureState();
    const old = fixturePack("90", "old"); old.fetchedAt = "2026-09-04T00:00:00.000Z";
    expect(installPack(state, old).pack.id).toBe("pack-1");
  });
});
