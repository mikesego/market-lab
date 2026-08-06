import { z } from "zod";

import { getStudentSession } from "@/lib/auth/student-session";
import { searchAlpacaAssets } from "@/lib/market/alpaca-assets";
import { inferInvestmentType, symbolLogoColor } from "@/lib/market/asset-utils";
import { marketDataProvider } from "@/lib/market/provider";
import type { InvestmentSearchResult } from "@/lib/market/search-types";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(1).max(80),
  category: z.enum(["all", "stock", "etf"]).default("all"),
});

export async function GET(request: Request) {
  const session = await getStudentSession();
  if (!session) return Response.json({ error: "Student sign-in required." }, { status: 401 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    category: url.searchParams.get("category") ?? "all",
  });
  if (!parsed.success) return Response.json({ error: "Enter a company name or ticker symbol." }, { status: 400 });

  try {
    const assets = await searchAlpacaAssets(parsed.data.q, parsed.data.category, 18);
    let quotes = new Map<string, Awaited<ReturnType<typeof marketDataProvider.getQuote>>>();
    if (assets.length) {
      try {
        const liveQuotes = await marketDataProvider.getQuotes(assets.map((asset) => asset.symbol));
        quotes = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));
      } catch {
        // Reference results remain useful; the detail page will retry the live quote.
      }
    }

    const results: InvestmentSearchResult[] = assets.map((asset) => {
      const assetType = inferInvestmentType(asset.name);
      const quote = quotes.get(asset.symbol);
      return {
        symbol: asset.symbol,
        name: asset.name,
        exchange: asset.exchange,
        assetType,
        sector: assetType === "etf" ? "Diversified fund" : "U.S. equity",
        description: assetType === "etf"
          ? "Open the research page to review this fund, its live price, and adjusted history."
          : "Open the research page to review this company, its live price, and adjusted history.",
        logoColor: symbolLogoColor(asset.symbol),
        price: quote?.price ?? null,
        changePercent: quote?.changePercent ?? null,
      };
    });

    return Response.json(
      { results, query: parsed.data.q, provider: marketDataProvider.id },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Investment search is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
