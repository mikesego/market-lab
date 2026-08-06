import { describe, expect, it } from "vitest";

import { normalizeAlpacaBars, normalizeAlpacaSnapshot } from "../../src/lib/market/alpaca-normalize";

describe("Alpaca market-data normalization", () => {
  it("normalizes a live IEX snapshot without losing the spread or source time", () => {
    const quote = normalizeAlpacaSnapshot("aapl", {
      latestTrade: { p: 101, t: "2026-08-05T15:00:30.000Z" },
      latestQuote: { bp: 100.5, ap: 101.5, t: "2026-08-05T15:00:31.000Z" },
      dailyBar: { c: 101, t: "2026-08-05T15:00:00.000Z" },
      prevDailyBar: { c: 100, t: "2026-08-04T20:00:00.000Z" },
    }, new Date("2026-08-05T15:01:00.000Z"));

    expect(quote).toMatchObject({
      symbol: "AAPL",
      price: 101,
      bidPrice: 100.5,
      askPrice: 101.5,
      previousClose: 100,
      change: 1,
      changePercent: 1,
      marketState: "open",
      source: "alpaca",
      feed: "iex",
      isStale: false,
    });
    expect(quote.providerEventId).toContain("2026-08-05T15:00:31.000Z");
  });

  it("marks an old event stale while the regular market is open", () => {
    const quote = normalizeAlpacaSnapshot("SPY", {
      latestTrade: { p: 600, t: "2026-08-05T14:55:00.000Z" },
      prevDailyBar: { c: 599, t: "2026-08-04T20:00:00.000Z" },
    }, new Date("2026-08-05T15:01:00.000Z"));

    expect(quote.isStale).toBe(true);
  });

  it("does not execute against an old spread when a newer trade exists", () => {
    const quote = normalizeAlpacaSnapshot("SPY", {
      latestTrade: { p: 600, t: "2026-08-05T15:00:30.000Z" },
      latestQuote: { bp: 590, ap: 610, t: "2026-08-05T14:55:00.000Z" },
      prevDailyBar: { c: 599, t: "2026-08-04T20:00:00.000Z" },
    }, new Date("2026-08-05T15:01:00.000Z"));

    expect(quote).toMatchObject({ price: 600, bidPrice: null, askPrice: null, isStale: false });
  });

  it("keeps the requested number of valid daily bars in chronological order", () => {
    const points = normalizeAlpacaBars([
      { t: "2026-08-01T04:00:00.000Z", c: 99 },
      { t: "2026-08-02T04:00:00.000Z", c: 100 },
      { t: "2026-08-03T04:00:00.000Z", c: 101 },
    ], 2);

    expect(points).toEqual([
      { at: "2026-08-02T04:00:00.000Z", price: 100 },
      { at: "2026-08-03T04:00:00.000Z", price: 101 },
    ]);
  });
});
