import "server-only";

import { z } from "zod";

import { normalizeAlpacaBars, normalizeAlpacaSnapshot, type AlpacaSnapshot } from "./alpaca-normalize";
import { MARKET_CATALOG } from "./catalog";
import type { PricePoint, Quote } from "./types";

const ALPACA_DATA_URL = "https://data.alpaca.markets";
const REQUEST_TIMEOUT_MS = 8_000;
const QUOTE_CACHE_MS = 3_000;

const barSchema = z.object({
  t: z.string(),
  c: z.number().positive(),
});

const snapshotSchema = z.object({
  latestTrade: z.object({ p: z.number(), t: z.string() }).nullable().optional(),
  latestQuote: z.object({ ap: z.number(), bp: z.number(), t: z.string() }).nullable().optional(),
  minuteBar: barSchema.nullable().optional(),
  dailyBar: barSchema.nullable().optional(),
  prevDailyBar: barSchema.nullable().optional(),
});

const snapshotsSchema = z.record(z.string(), snapshotSchema);
const barsResponseSchema = z.object({ bars: z.array(barSchema) });

type CacheEntry = { expiresAt: number; promise: Promise<Map<string, Quote>> };
const quoteCache = new Map<string, CacheEntry>();

export class MarketDataUnavailableError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "MarketDataUnavailableError";
  }
}

function credentials() {
  const keyId = process.env.APCA_API_KEY_ID?.trim();
  const secretKey = process.env.APCA_API_SECRET_KEY?.trim();
  if (!keyId || !secretKey) {
    throw new MarketDataUnavailableError("Alpaca market-data credentials are not configured.");
  }
  return { keyId, secretKey };
}

async function alpacaFetch(path: string) {
  const { keyId, secretKey } = credentials();
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${ALPACA_DATA_URL}${path}`, {
        cache: "no-store",
        headers: {
          "APCA-API-KEY-ID": keyId,
          "APCA-API-SECRET-KEY": secretKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return response.json() as Promise<unknown>;
      if (response.status !== 429 && response.status < 500) {
        throw new MarketDataUnavailableError(`Alpaca rejected the market-data request (${response.status}).`, response.status);
      }
      lastError = new MarketDataUnavailableError(`Alpaca market data is temporarily unavailable (${response.status}).`, response.status);
    } catch (error) {
      if (error instanceof MarketDataUnavailableError && error.status && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
    }

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
  }

  throw lastError instanceof MarketDataUnavailableError
    ? lastError
    : new MarketDataUnavailableError("Alpaca market data is temporarily unavailable.");
}

function normalizeSymbols(symbols: string[]) {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))].sort();
}

async function fetchQuoteMap(symbols: string[]) {
  const normalized = normalizeSymbols(symbols);
  if (!normalized.length) return new Map<string, Quote>();
  const key = normalized.join(",");
  const cached = quoteCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = (async () => {
    const params = new URLSearchParams({ symbols: key, feed: "iex" });
    const parsed = snapshotsSchema.safeParse(await alpacaFetch(`/v2/stocks/snapshots?${params}`));
    if (!parsed.success) throw new MarketDataUnavailableError("Alpaca returned an unexpected snapshot response.");
    const now = new Date();
    const result = new Map<string, Quote>();
    for (const symbol of normalized) {
      const snapshot = parsed.data[symbol] as AlpacaSnapshot | undefined;
      if (!snapshot) throw new MarketDataUnavailableError(`Alpaca did not return a quote for ${symbol}.`);
      result.set(symbol, normalizeAlpacaSnapshot(symbol, snapshot, now));
    }
    return result;
  })();

  quoteCache.set(key, { expiresAt: Date.now() + QUOTE_CACHE_MS, promise });
  try {
    return await promise;
  } catch (error) {
    quoteCache.delete(key);
    throw error;
  }
}

export async function getAlpacaQuote(symbol: string): Promise<Quote> {
  const upperSymbol = symbol.toUpperCase();
  const quote = (await fetchQuoteMap([upperSymbol])).get(upperSymbol);
  if (!quote) throw new MarketDataUnavailableError(`Alpaca did not return a quote for ${upperSymbol}.`);
  return quote;
}

export async function getAlpacaQuotes(
  symbols = MARKET_CATALOG.map((instrument) => instrument.symbol),
): Promise<Quote[]> {
  const normalized = normalizeSymbols(symbols);
  const quotes = await fetchQuoteMap(normalized);
  return normalized.map((symbol) => quotes.get(symbol)).filter((quote): quote is Quote => Boolean(quote));
}

export async function getAlpacaSeries(symbol: string, days = 30): Promise<PricePoint[]> {
  const upperSymbol = symbol.toUpperCase();
  const end = new Date(Date.now() - 16 * 60_000);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(days * 2 + 10, 45));
  const params = new URLSearchParams({
    feed: "iex",
    timeframe: "1Day",
    start: start.toISOString(),
    end: end.toISOString(),
    limit: String(Math.min(10_000, Math.max(days * 3, 100))),
    adjustment: "all",
    sort: "asc",
  });
  const parsed = barsResponseSchema.safeParse(await alpacaFetch(`/v2/stocks/${encodeURIComponent(upperSymbol)}/bars?${params}`));
  if (!parsed.success) throw new MarketDataUnavailableError(`Alpaca returned an unexpected price history for ${upperSymbol}.`);
  const points = normalizeAlpacaBars(parsed.data.bars, days);
  if (!points.length) throw new MarketDataUnavailableError(`Alpaca did not return price history for ${upperSymbol}.`);
  return points;
}

