import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { adultUsers } from "@/db/schema";

export async function requireTeacher() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) throw new Error("Unauthorized");
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const displayName = clerkUser
    ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email
    : email;
  const [adult] = await db
    .insert(adultUsers)
    .values({ clerkUserId: userId, email, displayName, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: adultUsers.clerkUserId,
      set: { email, displayName, lastSeenAt: new Date(), updatedAt: new Date() },
    })
    .returning();
  return { adult, clerkUser };
}

export async function getTeacherIfAuthenticated() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) return null;
  return requireTeacher();
}

export async function requireOperator() {
  const teacher = await requireTeacher();
  const email = teacher.adult.email?.trim().toLowerCase() ?? "";
  const configuredEmails = (process.env.OPERATOR_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const isConfiguredOperator = email.length > 0 && configuredEmails.includes(email);
  const isStoredOperator = teacher.adult.role === "operator";
  const isDevelopmentFallback = process.env.NODE_ENV !== "production" && configuredEmails.length === 0;

  if (!isConfiguredOperator && !isStoredOperator && !isDevelopmentFallback) {
    throw new Error("Forbidden");
  }
  return teacher;
}
