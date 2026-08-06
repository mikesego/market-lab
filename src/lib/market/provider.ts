import "server-only";

import { getAlpacaQuote, getAlpacaQuotes, getAlpacaSeries } from "./alpaca-provider";
import type { PricePoint, Quote } from "./types";

export type MarketDataProvider = {
  id: string;
  label: string;
  feed: "iex";
  isLive: boolean;
  usageMode: "personal-demo";
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols?: string[]): Promise<Quote[]>;
  getSeries(symbol: string, days?: number): Promise<PricePoint[]>;
};

export const marketDataProvider: MarketDataProvider = {
  id: "alpaca-basic-iex-v1",
  label: "Alpaca Basic · IEX",
  feed: "iex",
  isLive: true,
  usageMode: "personal-demo",
  getQuote: getAlpacaQuote,
  getQuotes: getAlpacaQuotes,
  getSeries: getAlpacaSeries,
};
