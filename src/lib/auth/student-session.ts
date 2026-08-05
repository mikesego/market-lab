import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/db";
import { games, portfolios, studentSessions, students } from "@/db/schema";
import { hashSessionToken } from "@/lib/security/student-credentials";

export const STUDENT_SESSION_COOKIE = "market_lab_student";
export const STUDENT_SESSION_DAYS = 14;

export const getStudentSession = cache(async function getStudentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [result] = await db
    .select({
      sessionId: studentSessions.id,
      sessionExpiresAt: studentSessions.expiresAt,
      studentId: students.id,
      username: students.username,
      displayName: students.displayName,
      avatarKey: students.avatarKey,
      classroomId: students.classroomId,
      gameId: games.id,
      gameName: games.name,
      joinCode: games.joinCode,
      gameStatus: games.status,
      dataMode: games.dataMode,
      startingCash: games.startingCash,
      startsAt: games.startsAt,
      endsAt: games.endsAt,
      allowFractional: games.allowFractional,
      maxPositionPercent: games.maxPositionPercent,
      portfolioId: portfolios.id,
      cashBalance: portfolios.cashBalance,
      reservedCash: portfolios.reservedCash,
    })
    .from(studentSessions)
    .innerJoin(students, eq(studentSessions.studentId, students.id))
    .innerJoin(games, eq(students.gameId, games.id))
    .innerJoin(
      portfolios,
      and(eq(portfolios.studentId, students.id), eq(portfolios.gameId, games.id)),
    )
    .where(
      and(
        eq(studentSessions.tokenHash, hashSessionToken(token)),
        gt(studentSessions.expiresAt, new Date()),
        isNull(studentSessions.revokedAt),
        eq(students.status, "active"),
      ),
    )
    .limit(1);

  return result ?? null;
});
