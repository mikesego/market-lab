import "server-only";

import { z } from "zod";

import {
  assetSearchScore,
  inferInvestmentType,
  isSupportedStockOrEtf,
  SUPPORTED_SYMBOL_PATTERN,
  type InvestmentType,
} from "./asset-utils";

const ALPACA_PAPER_URL = "https://paper-api.alpaca.markets";
const REQUEST_TIMEOUT_MS = 8_000;
const ASSET_CACHE_MS = 15 * 60_000;

const alpacaAssetSchema = z.object({
  id: z.string(),
  class: z.string(),
  exchange: z.string(),
  symbol: z.string(),
  name: z.string(),
  status: z.string(),
  tradable: z.boolean(),
  fractionable: z.boolean().default(false),
  attributes: z.array(z.string()).nullable().optional(),
});

const alpacaAssetListSchema = z.array(alpacaAssetSchema);

export type AlpacaAsset = z.infer<typeof alpacaAssetSchema>;

type CacheEntry<T> = { expiresAt: number; promise: Promise<T> };
let assetListCache: CacheEntry<AlpacaAsset[]> | undefined;
const exactAssetCache = new Map<string, CacheEntry<AlpacaAsset>>();

export class AssetUnavailableError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "AssetUnavailableError";
  }
}

function credentials() {
  const keyId = process.env.APCA_API_KEY_ID?.trim();
  const secretKey = process.env.APCA_API_SECRET_KEY?.trim();
  if (!keyId || !secretKey) throw new AssetUnavailableError("Alpaca credentials are not configured.");
  return { keyId, secretKey };
}

async function alpacaTradingFetch(path: string) {
  const { keyId, secretKey } = credentials();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${ALPACA_PAPER_URL}${path}`, {
        cache: "no-store",
        headers: {
          "APCA-API-KEY-ID": keyId,
          "APCA-API-SECRET-KEY": secretKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return response.json() as Promise<unknown>;
      if (response.status === 404) throw new AssetUnavailableError("That symbol was not found.", 404);
      if (response.status !== 429 && response.status < 500) {
        throw new AssetUnavailableError(`Alpaca rejected the asset request (${response.status}).`, response.status);
      }
      lastError = new AssetUnavailableError("Alpaca reference data is temporarily unavailable.", response.status);
    } catch (error) {
      if (error instanceof AssetUnavailableError && error.status && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 175));
  }
  throw lastError instanceof AssetUnavailableError
    ? lastError
    : new AssetUnavailableError("Alpaca reference data is temporarily unavailable.");
}

export async function getAlpacaAsset(rawSymbol: string) {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!SUPPORTED_SYMBOL_PATTERN.test(symbol)) throw new AssetUnavailableError("That ticker symbol is invalid.", 400);
  const cached = exactAssetCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = (async () => {
    const parsed = alpacaAssetSchema.safeParse(await alpacaTradingFetch(`/v2/assets/${encodeURIComponent(symbol)}`));
    if (!parsed.success) throw new AssetUnavailableError("Alpaca returned an unexpected asset response.");
    return parsed.data;
  })();
  exactAssetCache.set(symbol, { expiresAt: Date.now() + ASSET_CACHE_MS, promise });
  try {
    return await promise;
  } catch (error) {
    exactAssetCache.delete(symbol);
    throw error;
  }
}

async function getActiveAssets() {
  if (assetListCache && assetListCache.expiresAt > Date.now()) return assetListCache.promise;
  const promise = (async () => {
    const parsed = alpacaAssetListSchema.safeParse(
      await alpacaTradingFetch("/v2/assets?status=active&asset_class=us_equity"),
    );
    if (!parsed.success) throw new AssetUnavailableError("Alpaca returned an unexpected asset list.");
    return parsed.data.filter(isSupportedStockOrEtf);
  })();
  assetListCache = { expiresAt: Date.now() + ASSET_CACHE_MS, promise };
  try {
    return await promise;
  } catch (error) {
    assetListCache = undefined;
    throw error;
  }
}

export async function searchAlpacaAssets(
  rawQuery: string,
  category: InvestmentType | "all" = "all",
  limit = 18,
) {
  const query = rawQuery.trim().toUpperCase();
  if (!query) return [];

  if (SUPPORTED_SYMBOL_PATTERN.test(query)) {
    try {
      const exact = await getAlpacaAsset(query);
      if (isSupportedStockOrEtf(exact)
        && (category === "all" || inferInvestmentType(exact.name) === category)) return [exact];
    } catch (error) {
      if (!(error instanceof AssetUnavailableError) || error.status !== 404) throw error;
    }
  }

  const assets = await getActiveAssets();
  return assets
    .flatMap((asset) => {
      if (category !== "all" && inferInvestmentType(asset.name) !== category) return [];
      const score = assetSearchScore(asset, query);
      return Number.isFinite(score) ? [{ asset, score }] : [];
    })
    .sort((left, right) => left.score - right.score || left.asset.symbol.localeCompare(right.asset.symbol))
    .slice(0, limit)
    .map(({ asset }) => asset);
}
