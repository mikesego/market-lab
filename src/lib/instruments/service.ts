import "server-only";

import { db } from "@/db";
import { instruments } from "@/db/schema";
import type { AlpacaAsset } from "@/lib/market/alpaca-assets";
import { inferInvestmentType, symbolLogoColor } from "@/lib/market/asset-utils";
import { MARKET_CATALOG_BY_SYMBOL } from "@/lib/market/catalog";

export function profileAlpacaAsset(asset: AlpacaAsset) {
  const curated = MARKET_CATALOG_BY_SYMBOL.get(asset.symbol);
  const assetType = curated?.assetType ?? inferInvestmentType(asset.name);
  const fund = assetType === "etf";
  return {
    symbol: asset.symbol,
    name: curated?.name ?? asset.name,
    exchange: curated?.exchange ?? asset.exchange,
    assetType,
    sector: curated?.sector ?? (fund ? "Diversified fund" : "U.S. equity"),
    description: curated?.description ?? (fund
      ? `${asset.name} is an exchange-traded fund. Review what it holds, its costs, and the index or strategy it follows before deciding.`
      : `${asset.name} is an active U.S.-listed investment. Use company filings and trusted research to understand the business before deciding.`),
    logoColor: curated?.logoColor ?? symbolLogoColor(asset.symbol),
    whyItMoves: curated?.whyItMoves ?? (fund
      ? ["changes in its underlying holdings", "interest rates and the economy", "investor demand for its strategy"]
      : ["business results and outlook", "news and investor expectations", "the broader economy and market"]),
    fractionable: asset.fractionable,
  };
}

export async function syncAlpacaInstrument(asset: AlpacaAsset, currentPrice: number) {
  const profile = profileAlpacaAsset(asset);
  const [instrument] = await db
    .insert(instruments)
    .values({
      symbol: profile.symbol,
      name: profile.name,
      exchange: profile.exchange,
      assetType: profile.assetType,
      sector: profile.sector,
      description: profile.description,
      logoColor: profile.logoColor,
      basePrice: currentPrice.toFixed(6),
      isTradable: asset.status === "active" && asset.tradable,
      metadata: {
        alpacaAssetId: asset.id,
        alpacaStatus: asset.status,
        fractionable: asset.fractionable,
        source: "alpaca",
      },
    })
    .onConflictDoUpdate({
      target: instruments.symbol,
      set: {
        name: profile.name,
        exchange: profile.exchange,
        assetType: profile.assetType,
        sector: profile.sector,
        description: profile.description,
        logoColor: profile.logoColor,
        basePrice: currentPrice.toFixed(6),
        isTradable: asset.status === "active" && asset.tradable,
        metadata: {
          alpacaAssetId: asset.id,
          alpacaStatus: asset.status,
          fractionable: asset.fractionable,
          source: "alpaca",
        },
        updatedAt: new Date(),
      },
    })
    .returning();
  return { instrument, profile };
}
