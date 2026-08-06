export type MarketState = "open" | "closed" | "pre" | "after";

export type Quote = {
  symbol: string;
  price: number;
  bidPrice: number | null;
  askPrice: number | null;
  previousClose: number;
  change: number;
  changePercent: number;
  asOf: string;
  delayedMinutes: number;
  marketState: MarketState;
  source: "alpaca";
  feed: "iex";
  isStale: boolean;
  providerEventId: string;
};

export type PricePoint = { at: string; price: number };

