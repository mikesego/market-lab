import Decimal from "decimal.js";

import { getUsEquitySession } from "./calendar";
import type { PricePoint, Quote } from "./types";

export type AlpacaBar = {
  t: string;
  c: number;
};

export type AlpacaSnapshot = {
  latestTrade?: { p: number; t: string } | null;
  latestQuote?: { ap: number; bp: number; t: string } | null;
  minuteBar?: AlpacaBar | null;
  dailyBar?: AlpacaBar | null;
  prevDailyBar?: AlpacaBar | null;
};

function positive(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function latestTimestamp(...values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value) && !Number.isNaN(Date.parse(value as string)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

export function normalizeAlpacaSnapshot(
  symbol: string,
  snapshot: AlpacaSnapshot,
  now = new Date(),
): Quote {
  const marketState = getUsEquitySession(now).state;
  const isFreshDuringOpen = (timestamp: string | null | undefined) => {
    if (marketState !== "open") return true;
    if (!timestamp || Number.isNaN(Date.parse(timestamp))) return false;
    return Math.max(0, now.getTime() - Date.parse(timestamp)) <= 120_000;
  };
  const quoteIsFresh = isFreshDuringOpen(snapshot.latestQuote?.t);
  const tradeIsFresh = isFreshDuringOpen(snapshot.latestTrade?.t);
  const minuteBarIsFresh = isFreshDuringOpen(snapshot.minuteBar?.t);
  const bidPrice = quoteIsFresh ? positive(snapshot.latestQuote?.bp) : null;
  const askPrice = quoteIsFresh ? positive(snapshot.latestQuote?.ap) : null;
  const midpoint = bidPrice && askPrice ? new Decimal(bidPrice).plus(askPrice).div(2).toNumber() : null;
  const liveTrade = tradeIsFresh ? positive(snapshot.latestTrade?.p) : null;
  const liveMinuteBar = minuteBarIsFresh ? positive(snapshot.minuteBar?.c) : null;
  const price = liveTrade ?? midpoint ?? liveMinuteBar ?? positive(snapshot.latestTrade?.p) ?? positive(snapshot.minuteBar?.c) ?? positive(snapshot.dailyBar?.c);
  const previousClose = positive(snapshot.prevDailyBar?.c) ?? positive(snapshot.dailyBar?.c);
  if (!price || !previousClose) throw new Error(`Alpaca returned an incomplete snapshot for ${symbol}.`);

  const asOf = latestTimestamp(snapshot.latestTrade?.t, snapshot.latestQuote?.t, snapshot.minuteBar?.t, snapshot.dailyBar?.t);
  if (!asOf || Number.isNaN(Date.parse(asOf))) throw new Error(`Alpaca returned an invalid timestamp for ${symbol}.`);

  const change = new Decimal(price).minus(previousClose).toDecimalPlaces(4);
  const changePercent = change.div(previousClose).times(100).toDecimalPlaces(4);
  const hasFreshOpenPrice = Boolean(liveTrade ?? midpoint ?? liveMinuteBar);

  return {
    symbol: symbol.toUpperCase(),
    price: new Decimal(price).toDecimalPlaces(4).toNumber(),
    bidPrice,
    askPrice,
    previousClose,
    change: change.toNumber(),
    changePercent: changePercent.toNumber(),
    asOf,
    delayedMinutes: 0,
    marketState,
    source: "alpaca",
    feed: "iex",
    isStale: marketState === "open" && !hasFreshOpenPrice,
    providerEventId: `alpaca:iex:${symbol.toUpperCase()}:${asOf}`,
  };
}

export function normalizeAlpacaBars(bars: AlpacaBar[], days: number): PricePoint[] {
  return bars
    .filter((bar) => positive(bar.c) !== null && !Number.isNaN(Date.parse(bar.t)))
    .slice(-days)
    .map((bar) => ({ at: bar.t, price: new Decimal(bar.c).toDecimalPlaces(4).toNumber() }));
}
