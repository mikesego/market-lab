import { and, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import { corporateActions } from "@/db/schema";
import { isAuthorizedJobRequest } from "@/lib/jobs/authorize";
import { processAllEligibleOrders } from "@/lib/trading/order-service";
import { processCorporateAction } from "@/lib/trading/corporate-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runMarketJobs() {
  const ordersResult = await processAllEligibleOrders();
  const dueActions = await db
    .select({ id: corporateActions.id })
    .from(corporateActions)
    .where(and(eq(corporateActions.status, "pending"), lte(corporateActions.effectiveAt, new Date())))
    .limit(100);

  for (const action of dueActions) {
    await processCorporateAction(action.id);
  }

  return {
    ...ordersResult,
    corporateActionsChecked: dueActions.length,
    completedAt: new Date().toISOString(),
  };
}

async function handleMarketJob(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await runMarketJobs();
    console.info("market_job_completed", { ...result, durationMs: Date.now() - startedAt });
    return Response.json(
      { status: "ok", ...result, durationMs: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("market_job_failed", { error, durationMs: Date.now() - startedAt });
    return Response.json(
      { status: "error", completedAt: new Date().toISOString() },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

// Vercel Cron invokes production routes with GET. POST remains available for
// authenticated operator retries and local smoke tests.
export const GET = handleMarketJob;
export const POST = handleMarketJob;
