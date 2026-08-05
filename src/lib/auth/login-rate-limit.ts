import "server-only";

import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { loginRateLimits } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

async function fingerprint() {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = headerStore.get("user-agent")?.slice(0, 180) ?? "unknown";
  const secret = process.env.STUDENT_AUTH_PEPPER ?? process.env.CLERK_SECRET_KEY ?? "market-lab-development-only";
  return createHmac("sha256", secret).update(`${forwarded}|${userAgent}`).digest("hex");
}

export async function checkLoginRateLimit() {
  const keyHash = await fingerprint();
  const allowed = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(loginRateLimits).where(eq(loginRateLimits.keyHash, keyHash)).for("update").limit(1);
    if (!row) return true;
    const now = Date.now();
    if (row.blockedUntil && row.blockedUntil.getTime() > now) return false;
    if (now - row.windowStartedAt.getTime() > WINDOW_MS) {
      await tx.delete(loginRateLimits).where(eq(loginRateLimits.keyHash, keyHash));
      return true;
    }
    return row.attempts < MAX_ATTEMPTS;
  });
  return { allowed, keyHash };
}

export async function recordLoginFailure(keyHash: string) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(loginRateLimits).where(eq(loginRateLimits.keyHash, keyHash)).for("update").limit(1);
    const now = new Date();
    if (!row || now.getTime() - row.windowStartedAt.getTime() > WINDOW_MS) {
      await tx.insert(loginRateLimits).values({ keyHash, attempts: 1, windowStartedAt: now, updatedAt: now }).onConflictDoUpdate({ target: loginRateLimits.keyHash, set: { attempts: 1, windowStartedAt: now, blockedUntil: null, updatedAt: now } });
      return;
    }
    const attempts = row.attempts + 1;
    await tx.update(loginRateLimits).set({ attempts, blockedUntil: attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + WINDOW_MS) : null, updatedAt: now }).where(eq(loginRateLimits.keyHash, keyHash));
  });
}

export async function clearLoginFailures(keyHash: string) {
  await db.delete(loginRateLimits).where(eq(loginRateLimits.keyHash, keyHash));
}
