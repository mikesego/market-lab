export type InvestmentType = "stock" | "etf";

const ETF_NAME_PATTERN = /\b(?:ETF|FUND|PORTFOLIO|ISHARES|SPDR|VANGUARD|PROSHARES|DIREXION|INVESCO|WISDOMTREE|GLOBAL X|FIRST TRUST)\b/i;
const UNSUPPORTED_NAME_PATTERN = /\b(?:WARRANTS?|RIGHTS?|UNITS?|PREFERRED)\b/i;
const SUPPORTED_EXCHANGES = new Set(["AMEX", "ARCA", "BATS", "NASDAQ", "NYSE", "NYSEARCA"]);
export const SUPPORTED_SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/;

export type SearchableAsset = {
  symbol: string;
  name: string;
  exchange: string;
  class: string;
  status: string;
  tradable: boolean;
};

export function inferInvestmentType(name: string): InvestmentType {
  return ETF_NAME_PATTERN.test(name) ? "etf" : "stock";
}

export function isSupportedStockOrEtf(asset: SearchableAsset) {
  return asset.class === "us_equity"
    && asset.status === "active"
    && asset.tradable
    && SUPPORTED_SYMBOL_PATTERN.test(asset.symbol)
    && SUPPORTED_EXCHANGES.has(asset.exchange.toUpperCase())
    && !UNSUPPORTED_NAME_PATTERN.test(asset.name);
}

export function assetSearchScore(asset: Pick<SearchableAsset, "symbol" | "name">, query: string) {
  const normalized = query.trim().toUpperCase();
  const symbol = asset.symbol.toUpperCase();
  const name = asset.name.toUpperCase();
  if (symbol === normalized) return 0;
  if (symbol.startsWith(normalized)) return 1;
  if (name.startsWith(normalized)) return 2;
  if (name.split(/\s+/).some((word) => word.startsWith(normalized))) return 3;
  if (symbol.includes(normalized)) return 4;
  if (name.includes(normalized)) return 5;
  return Number.POSITIVE_INFINITY;
}

export function symbolLogoColor(symbol: string) {
  const palette = ["#285b50", "#315b75", "#465f7a", "#5b477d", "#6f443c", "#4b7b35", "#7b5628"];
  const hash = [...symbol].reduce((total, character) => total + character.charCodeAt(0), 0);
  return palette[hash % palette.length];
}
