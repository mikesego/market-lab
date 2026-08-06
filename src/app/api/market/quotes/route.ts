import { z } from "zod";

import { marketDataProvider } from "@/lib/market/provider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = z.string().trim().regex(/^[A-Za-z.,]{1,120}$/).optional().safeParse(url.searchParams.get("symbols") ?? undefined);
  if (!parsed.success) return Response.json({ error: "Invalid symbols." }, { status: 400 });
  try {
    const symbols = parsed.data ? parsed.data.split(",").slice(0, 25).map((symbol) => symbol.toUpperCase()) : undefined;
    const quotes = await marketDataProvider.getQuotes(symbols);
    return Response.json({ provider: marketDataProvider.id, mode: "personal-live-iex", quotes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Live market data is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
