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

export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return Response.json({ status: "ok", ...(await runMarketJobs()) });
  } catch (error) {
    console.error("Market job failed", error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
