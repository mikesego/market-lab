import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  assignmentSubmissions,
  assignments,
  auditEvents,
  classrooms,
  games,
  instruments,
  journalEntries,
  lessonProgress,
  lessons,
  orders,
  organizations,
  portfolios,
  students,
} from "@/db/schema";
import { getLeaderboardDTO } from "./student";

export type TeacherActivity = {
  id: string;
  studentId: string | null;
  studentName: string;
  kind: "order" | "login" | "learning" | "assignment" | "journal" | "roster" | "season";
  title: string;
  detail: string;
  status: string;
  symbol: string | null;
  occurredAt: Date;
};

export async function getOwnedTeacherGame(gameId: string, ownerId: string) {
  const [row] = await db
    .select({ game: games, classroom: classrooms, organization: organizations })
    .from(games)
    .leftJoin(classrooms, eq(classrooms.gameId, games.id))
    .leftJoin(organizations, eq(organizations.id, games.organizationId))
    .where(and(eq(games.id, gameId), eq(games.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function getTeacherGameDTO(joinCode = "OAK-724") {
  const [game] = await db.select({ id: games.id }).from(games).where(eq(games.joinCode, joinCode)).limit(1);
  return game ? getTeacherGameDTOById(game.id) : null;
}

export async function getTeacherGameDTOById(gameId: string) {
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) return null;
  const [classroom] = await db.select().from(classrooms).where(eq(classrooms.gameId, game.id)).limit(1);

  const [studentRows, orderRows, orderCountRows, assignmentRows, submissionRows, lessonRows, progressRows, journalRows, auditRows] = await Promise.all([
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
      .limit(250),
    db
      .select({ value: count() })
      .from(orders)
      .innerJoin(portfolios, eq(orders.portfolioId, portfolios.id))
      .where(eq(portfolios.gameId, game.id)),
    db.select().from(assignments).where(eq(assignments.gameId, game.id)).orderBy(desc(assignments.createdAt)),
    db
      .select({
        assignmentId: assignmentSubmissions.assignmentId,
        studentId: assignmentSubmissions.studentId,
        status: assignmentSubmissions.status,
        response: assignmentSubmissions.response,
        teacherFeedback: assignmentSubmissions.teacherFeedback,
        submittedAt: assignmentSubmissions.submittedAt,
        reviewedAt: assignmentSubmissions.reviewedAt,
      })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .where(eq(assignments.gameId, game.id)),
    db.select().from(lessons).orderBy(asc(lessons.position)),
    db
      .select({ studentId: lessonProgress.studentId, lessonId: lessonProgress.lessonId, status: lessonProgress.status, score: lessonProgress.score })
      .from(lessonProgress)
      .innerJoin(students, eq(lessonProgress.studentId, students.id))
      .where(eq(students.gameId, game.id)),
    db
      .select({ studentId: journalEntries.studentId, thesis: journalEntries.thesis, createdAt: journalEntries.createdAt })
      .from(journalEntries)
      .where(eq(journalEntries.gameId, game.id))
      .orderBy(desc(journalEntries.createdAt)),
    db
      .select({
        id: auditEvents.id,
        actorType: auditEvents.actorType,
        actorId: auditEvents.actorId,
        action: auditEvents.action,
        targetId: auditEvents.targetId,
        metadata: auditEvents.metadata,
        occurredAt: auditEvents.occurredAt,
      })
      .from(auditEvents)
      .where(eq(auditEvents.gameId, game.id))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(250),
  ]);

  const leaderboard = await getLeaderboardDTO(game.id, Number(game.startingCash));
  const leaderboardByStudent = new Map(leaderboard.map((row) => [row.studentId, row]));
  const journalByStudent = new Map<string, number>();
  for (const row of journalRows) journalByStudent.set(row.studentId, (journalByStudent.get(row.studentId) ?? 0) + 1);
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
  const studentNames = new Map(roster.map((student) => [student.id, student.displayName]));
  const lessonNames = new Map(lessonRows.map((lesson) => [lesson.id, lesson.title]));
  const assignmentNames = new Map(assignmentRows.map((assignment) => [assignment.id, assignment.title]));

  const activity: TeacherActivity[] = [
    ...orderRows.map((order): TeacherActivity => ({
      id: `order-${order.id}`,
      studentId: order.studentId,
      studentName: order.displayName,
      kind: "order",
      title: `${capitalize(order.side)} ${order.symbol}`,
      detail: `${formatQuantity(order.quantity)} shares · ${order.type} order`,
      status: order.status,
      symbol: order.symbol,
      occurredAt: order.submittedAt,
    })),
    ...auditRows
      .filter((event) => !["order_submitted", "student_login_failed", "journal_created"].includes(event.action))
      .map((event): TeacherActivity => {
        const studentId = event.actorType === "student" ? event.actorId : null;
        return {
          id: `audit-${event.id}`,
          studentId,
          studentName: studentId ? studentNames.get(studentId) ?? "Student" : "Teacher",
          ...describeAudit(event.action, event.targetId, event.metadata, lessonNames, assignmentNames),
          occurredAt: event.occurredAt,
        };
      }),
    ...journalRows.map((entry, index): TeacherActivity => ({
      id: `journal-${entry.studentId}-${entry.createdAt.getTime()}-${index}`,
      studentId: entry.studentId,
      studentName: studentNames.get(entry.studentId) ?? "Student",
      kind: "journal",
      title: "Added a decision-journal entry",
      detail: entry.thesis.length > 95 ? `${entry.thesis.slice(0, 95)}…` : entry.thesis,
      status: "recorded",
      symbol: null,
      occurredAt: entry.createdAt,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  const submissionsByAssignment = new Map<string, typeof submissionRows>();
  for (const submission of submissionRows) {
    const current = submissionsByAssignment.get(submission.assignmentId) ?? [];
    current.push(submission);
    submissionsByAssignment.set(submission.assignmentId, current);
  }
  const assignmentDetails = assignmentRows.map((assignment) => {
    const submissions = submissionsByAssignment.get(assignment.id) ?? [];
    return {
      ...assignment,
      submissions,
      submittedCount: submissions.length,
      reviewedCount: submissions.filter((submission) => submission.status === "reviewed").length,
    };
  });
  const now = new Date();
  const enabledLessonIds = Array.isArray(game.config.enabledLessonIds)
    ? new Set(game.config.enabledLessonIds.filter((value): value is string => typeof value === "string"))
    : new Set(lessonRows.map((lesson) => lesson.id));
  const activeLessons = lessonRows.filter((lesson) => enabledLessonIds.has(lesson.id));
  const dueAssignments = assignmentDetails.filter((assignment) => !assignment.dueAt || assignment.dueAt >= now);
  const missingAssignmentCount = dueAssignments.reduce((total, assignment) => total + Math.max(0, roster.length - assignment.submittedCount), 0);
  const thinJournalCount = journalRows.filter((entry) => entry.thesis.trim().length < 80).length;

  return {
    game,
    classroom,
    roster,
    orders: orderRows,
    assignments: assignmentDetails,
    lessons: lessonRows.map((lesson) => ({ ...lesson, enabled: enabledLessonIds.has(lesson.id) })),
    activeLessons,
    submissions: submissionRows,
    activity,
    leaderboard,
    attention: {
      missingAssignmentCount,
      thinJournalCount,
      inactiveStudentCount: roster.filter((student) => !student.lastSeenAt || Date.now() - student.lastSeenAt.getTime() > 7 * 86_400_000).length,
    },
    stats: {
      students: roster.length,
      activeToday: roster.filter((student) => student.lastSeenAt && Date.now() - student.lastSeenAt.getTime() < 86_400_000).length,
      orders: Number(orderCountRows[0]?.value ?? 0),
      lessonsComplete: progressRows.filter((row) => row.status === "completed").length,
      classEquity: leaderboard.reduce((total, row) => total + row.equity, 0),
    },
  };
}

function describeAudit(
  action: string,
  targetId: string | null,
  metadata: Record<string, unknown>,
  lessonNames: Map<string, string>,
  assignmentNames: Map<string, string>,
): Pick<TeacherActivity, "kind" | "title" | "detail" | "status" | "symbol"> {
  switch (action) {
    case "student_login_succeeded":
      return { kind: "login", title: "Signed in", detail: "Student workspace opened", status: "successful", symbol: null };
    case "lesson_completed":
      return { kind: "learning", title: "Completed a lesson", detail: lessonNames.get(targetId ?? "") ?? "Learning lab", status: "completed", symbol: null };
    case "assignment_submitted":
      return { kind: "assignment", title: "Submitted an assignment", detail: assignmentNames.get(targetId ?? "") ?? "Class assignment", status: "submitted", symbol: null };
    case "assignment_reviewed":
      return { kind: "assignment", title: "Assignment reviewed", detail: assignmentNames.get(targetId ?? "") ?? "Class assignment", status: "reviewed", symbol: null };
    case "student_created":
      return { kind: "roster", title: "Student account created", detail: String(metadata.username ?? "Login card ready"), status: "active", symbol: null };
    case "student_status_changed":
      return { kind: "roster", title: "Student access updated", detail: `Status: ${String(metadata.status ?? "updated")}`, status: String(metadata.status ?? "updated"), symbol: null };
    case "student_pin_reset":
      return { kind: "roster", title: "Student PIN reset", detail: "A new private PIN was saved", status: "updated", symbol: null };
    case "assignment_created":
      return { kind: "assignment", title: "Assignment created", detail: assignmentNames.get(targetId ?? "") ?? "Class assignment", status: "assigned", symbol: null };
    case "journal_created":
      return { kind: "journal", title: "Added a decision-journal entry", detail: "Reflection saved", status: "recorded", symbol: null };
    default:
      return { kind: "season", title: action.split("_").map(capitalize).join(" "), detail: "Season activity", status: "recorded", symbol: null };
  }
}

function formatQuantity(quantity: string) {
  return Number(quantity).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

export async function getTeacherOwnedGames(ownerId: string) {
  return db.select().from(games).where(eq(games.ownerId, ownerId)).orderBy(desc(games.createdAt));
}
