import { sql } from "drizzle-orm";

import { db } from "@/db";
import { marketDataProvider } from "@/lib/market/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [, quote] = await Promise.all([db.execute(sql`select 1 as ok`), marketDataProvider.getQuote("SPY")]);
    return Response.json({ status: "ok", database: "ok", marketData: marketDataProvider.id, marketDataAsOf: quote.asOf, usageMode: marketDataProvider.usageMode, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", marketData: marketDataProvider.id, checkedAt: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
