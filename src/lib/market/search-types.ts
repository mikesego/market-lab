import type { InvestmentType } from "./asset-utils";

export type InvestmentSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  assetType: InvestmentType;
  sector: string;
  description: string;
  logoColor: string;
  price: number | null;
  changePercent: number | null;
};
