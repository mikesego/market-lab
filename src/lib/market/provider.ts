import "server-only";

import { getReplayQuote, getReplayQuotes, getReplaySeries } from "./replay-provider";

export type MarketDataProvider = {
  id: string;
  label: string;
  isLicensedForStudents: boolean;
  getQuote: typeof getReplayQuote;
  getQuotes: typeof getReplayQuotes;
  getSeries: typeof getReplaySeries;
};

/**
 * The only active provider during development. A licensed provider can implement
 * this interface without changing trading, portfolio, or UI code.
 */
export const marketDataProvider: MarketDataProvider = {
  id: "deterministic-replay-v1",
  label: "Market Lab Replay",
  isLicensedForStudents: false,
  getQuote: getReplayQuote,
  getQuotes: getReplayQuotes,
  getSeries: getReplaySeries,
};
