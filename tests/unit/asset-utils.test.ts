import { describe, expect, it } from "vitest";

import { assetSearchScore, inferInvestmentType, isSupportedStockOrEtf } from "../../src/lib/market/asset-utils";

const commonAsset = {
  symbol: "SBUX",
  name: "Starbucks Corporation Common Stock",
  exchange: "NASDAQ",
  class: "us_equity",
  status: "active",
  tradable: true,
};

describe("Alpaca asset filtering", () => {
  it("accepts active tradable U.S. common stocks and ADRs", () => {
    expect(isSupportedStockOrEtf(commonAsset)).toBe(true);
    expect(isSupportedStockOrEtf({ ...commonAsset, symbol: "NVO", name: "Novo Nordisk A/S American Depositary Receipt" })).toBe(true);
  });

  it("rejects instruments that are not suitable stocks or ETFs", () => {
    expect(isSupportedStockOrEtf({ ...commonAsset, name: "Example Corp Warrant" })).toBe(false);
    expect(isSupportedStockOrEtf({ ...commonAsset, status: "inactive" })).toBe(false);
    expect(isSupportedStockOrEtf({ ...commonAsset, tradable: false })).toBe(false);
  });

  it("recognizes common fund names and prioritizes exact ticker matches", () => {
    expect(inferInvestmentType("SPDR S&P 500 ETF Trust")).toBe("etf");
    expect(inferInvestmentType(commonAsset.name)).toBe("stock");
    expect(assetSearchScore(commonAsset, "SBUX")).toBe(0);
    expect(assetSearchScore(commonAsset, "Starbucks")).toBe(2);
  });
});
