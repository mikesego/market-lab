import Decimal from "decimal.js";

import { MARKET_CATALOG, MARKET_CATALOG_BY_SYMBOL } from "./catalog";
import { getUsEquitySession } from "./calendar";

export type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  asOf: string;
  delayedMinutes: number;
  marketState: "open" | "closed" | "pre" | "after";
  source: "deterministic-replay";
};

export type PricePoint = { at: string; price: number };

function symbolSeed(symbol: string) {
  return [...symbol].reduce((sum, letter, index) => sum + letter.charCodeAt(0) * (index + 7), 0);
}

function replayDay(at: Date) {
  return Math.floor((at.getTime() - Date.UTC(2025, 0, 1)) / 86_400_000);
}

function sessionProgress(at: Date) {
  const easternParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(at);
  const hour = Number(easternParts.find((part) => part.type === "hour")?.value ?? 12);
  const minute = Number(easternParts.find((part) => part.type === "minute")?.value ?? 0);
  return Math.max(0, Math.min(1, (hour * 60 + minute - 570) / 390));
}

export function getMarketState(at = new Date()): Quote["marketState"] {
  return getUsEquitySession(at).state;
}

function closeMultiplier(symbol: string, day: number, volatility: number) {
  const seed = symbolSeed(symbol);
  const slow = Math.sin((day + seed) * 0.071) * volatility * 2.1;
  const medium = Math.sin((day * 0.31 + seed * 0.17)) * volatility * 0.9;
  const drift = Math.sin(seed * 0.013) * 0.000045 * day;
  return 1 + slow + medium + drift;
}

export function getReplayQuote(symbol: string, at = new Date()): Quote {
  const instrument = MARKET_CATALOG_BY_SYMBOL.get(symbol.toUpperCase());
  if (!instrument) throw new Error(`Unknown instrument: ${symbol}`);

  const day = replayDay(at);
  const previousClose = new Decimal(instrument.basePrice)
    .times(closeMultiplier(instrument.symbol, day - 1, instrument.volatility))
    .toDecimalPlaces(2);
  const close = new Decimal(instrument.basePrice)
    .times(closeMultiplier(instrument.symbol, day, instrument.volatility));
  const progress = sessionProgress(at);
  const intraday = Math.sin(progress * Math.PI * 2 + symbolSeed(symbol)) * instrument.volatility * 0.2;
  const state = getMarketState(at);
  const price = (state === "open" ? previousClose.plus(close.minus(previousClose).times(progress)).times(1 + intraday) : close)
    .toDecimalPlaces(2);
  const change = price.minus(previousClose).toDecimalPlaces(2);
  const changePercent = change.div(previousClose).times(100).toDecimalPlaces(2);

  return {
    symbol: instrument.symbol,
    price: price.toNumber(),
    previousClose: previousClose.toNumber(),
    change: change.toNumber(),
    changePercent: changePercent.toNumber(),
    asOf: at.toISOString(),
    delayedMinutes: 0,
    marketState: state,
    source: "deterministic-replay",
  };
}

export function getReplayQuotes(at = new Date()) {
  return MARKET_CATALOG.map((instrument) => getReplayQuote(instrument.symbol, at));
}

export function getReplaySeries(symbol: string, days = 30, at = new Date()): PricePoint[] {
  return Array.from({ length: days }, (_, index) => {
    const pointAt = new Date(at);
    pointAt.setUTCDate(at.getUTCDate() - (days - 1 - index));
    pointAt.setUTCHours(20, 0, 0, 0);
    const quote = getReplayQuote(symbol, pointAt);
    return { at: pointAt.toISOString(), price: quote.price };
  });
}
