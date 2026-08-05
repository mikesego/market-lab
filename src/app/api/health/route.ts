import { sql } from "drizzle-orm";

import { db } from "@/db";
import { marketDataProvider } from "@/lib/market/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1 as ok`);
    return Response.json({ status: "ok", database: "ok", marketData: marketDataProvider.id, licensedForStudents: marketDataProvider.isLicensedForStudents, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable", checkedAt: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
