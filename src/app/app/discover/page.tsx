import { DiscoverBrowser } from "@/components/discover-browser";
import { MARKET_CATALOG } from "@/lib/market/catalog";
import { marketDataProvider } from "@/lib/market/provider";
import type { InvestmentSearchResult } from "@/lib/market/search-types";

export default async function DiscoverPage() {
  const liveQuotes = await marketDataProvider.getQuotes(MARKET_CATALOG.map((instrument) => instrument.symbol));
  const quotesBySymbol = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));
  const featured: InvestmentSearchResult[] = MARKET_CATALOG.flatMap((instrument) => {
    const quote = quotesBySymbol.get(instrument.symbol);
    return quote ? [{
      symbol: instrument.symbol,
      name: instrument.name,
      exchange: instrument.exchange,
      assetType: instrument.assetType,
      sector: instrument.sector,
      description: instrument.description,
      logoColor: instrument.logoColor,
      price: quote.price,
      changePercent: quote.changePercent,
    }] : [];
  });
  return <>
    <div className="page-title"><div><span className="eyebrow">Research desk</span><h1>Discover investments</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Start with the business and the risk—not today’s color.</p></div></div>
    <DiscoverBrowser featured={featured} />
  </>;
}
