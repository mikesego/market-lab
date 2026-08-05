import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  assignments,
  classrooms,
  games,
  instruments,
  journalEntries,
  lessonProgress,
  lessons,
  orders,
  portfolios,
  students,
} from "@/db/schema";
import { getLeaderboardDTO } from "./student";

export async function getTeacherGameDTO(joinCode = "OAK-724") {
  const [game] = await db.select().from(games).where(eq(games.joinCode, joinCode)).limit(1);
  if (!game) return null;
  const [classroom] = await db.select().from(classrooms).where(eq(classrooms.gameId, game.id)).limit(1);
  const [studentRows, orderRows, assignmentRows, lessonRows, progressRows, journalCounts] = await Promise.all([
    db
      .select({
        id: students.id,
        displayName: students.displayName,
        username: students.username,
        avatarKey: students.avatarKey,
        lastSeenAt: students.lastSeenAt,
        status: students.status,
        portfolioId: portfolios.id,
        cashBalance: portfolios.cashBalance,
      })
      .from(students)
      .innerJoin(portfolios, and(eq(portfolios.studentId, students.id), eq(portfolios.gameId, game.id)))
      .where(eq(students.gameId, game.id))
      .orderBy(asc(students.displayName)),
    db
      .select({
        id: orders.id,
        studentId: students.id,
        displayName: students.displayName,
        symbol: instruments.symbol,
        side: orders.side,
        type: orders.orderType,
        quantity: orders.quantity,
        status: orders.status,
        submittedAt: orders.submittedAt,
      })
      .from(orders)
      .innerJoin(portfolios, eq(orders.portfolioId, portfolios.id))
      .innerJoin(students, eq(portfolios.studentId, students.id))
      .innerJoin(instruments, eq(orders.instrumentId, instruments.id))
      .where(eq(portfolios.gameId, game.id))
      .orderBy(desc(orders.submittedAt))
      .limit(30),
    db.select().from(assignments).where(eq(assignments.gameId, game.id)).orderBy(desc(assignments.createdAt)),
    db.select().from(lessons).orderBy(asc(lessons.position)),
    db
      .select({ studentId: lessonProgress.studentId, lessonId: lessonProgress.lessonId, status: lessonProgress.status, score: lessonProgress.score })
      .from(lessonProgress)
      .innerJoin(students, eq(lessonProgress.studentId, students.id))
      .where(eq(students.gameId, game.id)),
    db
      .select({ studentId: journalEntries.studentId, value: count() })
      .from(journalEntries)
      .where(eq(journalEntries.gameId, game.id))
      .groupBy(journalEntries.studentId),
  ]);
  const leaderboard = await getLeaderboardDTO(game.id);
  const leaderboardByStudent = new Map(leaderboard.map((row) => [row.studentId, row]));
  const journalByStudent = new Map(journalCounts.map((row) => [row.studentId, Number(row.value)]));
  const completedByStudent = new Map<string, number>();
  for (const row of progressRows) {
    if (row.status === "completed") completedByStudent.set(row.studentId, (completedByStudent.get(row.studentId) ?? 0) + 1);
  }
  const roster = studentRows.map((student) => ({
    ...student,
    rank: leaderboardByStudent.get(student.id)?.rank ?? null,
    equity: leaderboardByStudent.get(student.id)?.equity ?? Number(student.cashBalance),
    returnPercent: leaderboardByStudent.get(student.id)?.returnPercent ?? 0,
    lessonsCompleted: completedByStudent.get(student.id) ?? 0,
    journalCount: journalByStudent.get(student.id) ?? 0,
  }));
  return {
    game,
    classroom,
    roster,
    orders: orderRows,
    assignments: assignmentRows,
    lessons: lessonRows,
    leaderboard,
    stats: {
      students: roster.length,
      activeToday: roster.filter((student) => student.lastSeenAt && Date.now() - student.lastSeenAt.getTime() < 86_400_000).length,
      orders: orderRows.length,
      lessonsComplete: progressRows.filter((row) => row.status === "completed").length,
      classEquity: leaderboard.reduce((total, row) => total + row.equity, 0),
    },
  };
}

export async function getTeacherOwnedGames(ownerId: string) {
  return db.select().from(games).where(eq(games.ownerId, ownerId)).orderBy(desc(games.createdAt));
}
