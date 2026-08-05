"use server";

import { and, eq, ilike } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { auditEvents, games, studentSessions, students } from "@/db/schema";
import {
  STUDENT_SESSION_COOKIE,
  STUDENT_SESSION_DAYS,
  getStudentSession,
} from "@/lib/auth/student-session";
import {
  createSessionToken,
  hashSessionToken,
  verifyPin,
} from "@/lib/security/student-credentials";
import { checkLoginRateLimit, clearLoginFailures, recordLoginFailure } from "@/lib/auth/login-rate-limit";

export type JoinState = { error?: string; values?: { code: string; username: string } };

const joinSchema = z.object({
  code: z.string().trim().min(4).max(12).transform((value) => value.toUpperCase()),
  username: z.string().trim().min(2).max(32),
  pin: z.string().regex(/^\d{4,8}$/),
});

export async function joinStudent(_previous: JoinState, formData: FormData): Promise<JoinState> {
  const rateLimit = await checkLoginRateLimit();
  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Wait 15 minutes or ask your teacher for help." };
  }
  const parsed = joinSchema.safeParse({
    code: formData.get("code"),
    username: formData.get("username"),
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return {
      error: "Check the class code, username, and 4–8 digit PIN.",
      values: {
        code: String(formData.get("code") ?? ""),
        username: String(formData.get("username") ?? ""),
      },
    };
  }

  const [student] = await db
    .select({
      id: students.id,
      pinHash: students.pinHash,
      gameId: games.id,
      gameStatus: games.status,
    })
    .from(students)
    .innerJoin(games, eq(students.gameId, games.id))
    .where(
      and(
        eq(games.joinCode, parsed.data.code),
        ilike(students.username, parsed.data.username),
        eq(students.status, "active"),
      ),
    )
    .limit(1);

  const valid = student ? await verifyPin(parsed.data.pin, student.pinHash) : false;
  if (!student || !valid) {
    await recordLoginFailure(rateLimit.keyHash);
    await db.insert(auditEvents).values({
      actorType: "anonymous",
      action: "student_login_failed",
      targetType: "game_code",
      metadata: { codePrefix: parsed.data.code.slice(0, 3) },
    });
    return {
      error: "We couldn’t match those details. Ask your teacher to check your login card.",
      values: { code: parsed.data.code, username: parsed.data.username },
    };
  }

  await clearLoginFailures(rateLimit.keyHash);

  if (!['active', 'paused'].includes(student.gameStatus)) {
    return { error: "This season is not accepting student logins right now." };
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + STUDENT_SESSION_DAYS * 86_400_000);
  await db.transaction(async (tx) => {
    await tx.insert(studentSessions).values({
      studentId: student.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });
    await tx.update(students).set({ lastSeenAt: new Date(), updatedAt: new Date() }).where(eq(students.id, student.id));
    await tx.insert(auditEvents).values({
      actorType: "student",
      actorId: student.id,
      action: "student_login_succeeded",
      gameId: student.gameId,
    });
  });

  const cookieStore = await cookies();
  cookieStore.set(STUDENT_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  redirect("/app");
}

export async function signOutStudent() {
  const session = await getStudentSession();
  if (session) {
    await db
      .update(studentSessions)
      .set({ revokedAt: new Date() })
      .where(eq(studentSessions.id, session.sessionId));
  }
  const cookieStore = await cookies();
  cookieStore.delete(STUDENT_SESSION_COOKIE);
  redirect("/join");
}
