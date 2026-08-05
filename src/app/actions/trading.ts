"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getStudentSession } from "@/lib/auth/student-session";
import { cancelOrder, placeOrder, processEligibleOrdersForPortfolio, TradingError } from "@/lib/trading/order-service";

export type TradeState = { error?: string };

const tradeSchema = z.object({
  symbol: z.string().trim().regex(/^[A-Za-z.]{1,8}$/),
  side: z.enum(["buy", "sell"]),
  orderType: z.enum(["market", "limit"]),
  quantity: z.string().trim().min(1).max(20),
  limitPrice: z.string().trim().max(20).optional(),
  rationale: z.string().trim().min(20, "Write at least one complete reason (20 characters). ").max(600),
  confidence: z.coerce.number().int().min(1).max(5),
});

export async function submitTrade(_previous: TradeState, formData: FormData): Promise<TradeState> {
  const session = await getStudentSession();
  if (!session) return { error: "Your student session expired. Sign in again." };
  const parsed = tradeSchema.safeParse({
    symbol: formData.get("symbol"),
    side: formData.get("side"),
    orderType: formData.get("orderType"),
    quantity: formData.get("quantity"),
    limitPrice: formData.get("limitPrice") ?? undefined,
    rationale: formData.get("rationale"),
    confidence: formData.get("confidence"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the order details and try again." };
  }

  try {
    const result = await placeOrder({
      studentId: session.studentId,
      gameId: session.gameId,
      portfolioId: session.portfolioId,
      symbol: parsed.data.symbol,
      side: parsed.data.side,
      orderType: parsed.data.orderType,
      quantity: parsed.data.quantity,
      limitPrice: parsed.data.limitPrice,
      rationale: parsed.data.rationale,
      confidence: parsed.data.confidence,
      allowFractional: session.allowFractional,
      maxPositionPercent: session.maxPositionPercent,
      clientOrderId: randomUUID(),
    });
    revalidatePath("/app");
    revalidatePath("/app/orders");
    redirect(`/app/orders?placed=${result.status}&symbol=${result.symbol}`);
  } catch (error) {
    if (error instanceof TradingError) return { error: error.message };
    throw error;
  }
}

export async function cancelStudentOrder(formData: FormData) {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const orderId = z.string().uuid().parse(formData.get("orderId"));
  await cancelOrder({ orderId, studentId: session.studentId, portfolioId: session.portfolioId, gameId: session.gameId });
  revalidatePath("/app/orders");
}

export async function refreshStudentOrders() {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  await processEligibleOrdersForPortfolio(session.portfolioId);
  revalidatePath("/app");
  revalidatePath("/app/orders");
}
