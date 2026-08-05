import { z } from "zod";

import { marketDataProvider } from "@/lib/market/provider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = z.string().trim().regex(/^[A-Za-z.,]{1,120}$/).optional().safeParse(url.searchParams.get("symbols") ?? undefined);
  if (!parsed.success) return Response.json({ error: "Invalid symbols." }, { status: 400 });
  try {
    const quotes = parsed.data
      ? parsed.data.split(",").slice(0, 25).map((symbol) => marketDataProvider.getQuote(symbol.toUpperCase()))
      : marketDataProvider.getQuotes();
    return Response.json({ provider: marketDataProvider.id, mode: "development-replay", quotes }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "One or more symbols are unavailable." }, { status: 404 });
  }
}
