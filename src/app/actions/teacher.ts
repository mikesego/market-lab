"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import {
  assignmentSubmissions,
  assignments,
  auditEvents,
  lessons,
  classrooms,
  games,
  organizationMemberships,
  organizations,
  cashLedger,
  portfolios,
  students,
} from "@/db/schema";
import { requireTeacher } from "@/lib/auth/teacher";
import { hashPin } from "@/lib/security/student-credentials";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function revalidateTeacherGame(gameId: string) {
  revalidatePath(`/teacher/games/${gameId}`, "layout");
  revalidatePath("/teacher/games");
}

async function requireOwnedGame(gameId: string) {
  const { adult } = await requireTeacher();
  const [game] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.ownerId, adult.id))).limit(1);
  if (!game) throw new Error("Season not found.");
  return { adult, game };
}

async function uniqueJoinCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const letters = randomBytes(2).toString("hex").slice(0, 3).toUpperCase();
    const digits = String(Math.floor(100 + Math.random() * 900));
    const code = `${letters}-${digits}`;
    const [existing] = await db.select({ id: games.id }).from(games).where(eq(games.joinCode, code)).limit(1);
    if (!existing) return code;
  }
  throw new Error("Unable to generate a class code. Try again.");
}

export async function createSeason(formData: FormData) {
  const { adult } = await requireTeacher();
  const parsed = z.object({
    schoolName: z.string().trim().min(2).max(100),
    classroomName: z.string().trim().min(2).max(100),
    seasonName: z.string().trim().min(2).max(100),
    gradeBand: z.enum(["3-5", "6-8", "mixed"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    maxPositionPercent: z.coerce.number().min(10).max(100),
  }).parse({
    schoolName: formData.get("schoolName"),
    classroomName: formData.get("classroomName"),
    seasonName: formData.get("seasonName"),
    gradeBand: formData.get("gradeBand"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    maxPositionPercent: formData.get("maxPositionPercent"),
  });
  if (parsed.endsAt <= parsed.startsAt) throw new Error("End date must be after the start date.");

  const schoolSlug = `${slugify(parsed.schoolName)}-${adult.id.slice(0, 6)}`;
  const joinCode = await uniqueJoinCode();
  const [game] = await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({ name: parsed.schoolName, slug: schoolSlug })
      .onConflictDoUpdate({ target: organizations.slug, set: { name: parsed.schoolName, updatedAt: new Date() } })
      .returning();
    await tx.insert(organizationMemberships).values({ organizationId: organization.id, userId: adult.id, role: "owner" }).onConflictDoNothing();
    const [createdGame] = await tx.insert(games).values({
      organizationId: organization.id,
      ownerId: adult.id,
      name: parsed.seasonName,
      joinCode,
      status: "draft",
      dataMode: "alpaca_iex",
      startingCash: "100000",
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      maxPositionPercent: parsed.maxPositionPercent.toString(),
      config: { rationaleRequired: true, leaderboardVisibility: "class_aliases", benchmark: "SPY" },
    }).returning();
    await tx.insert(classrooms).values({ gameId: createdGame.id, name: parsed.classroomName, gradeBand: parsed.gradeBand });
    await tx.insert(auditEvents).values({ actorType: "adult", actorId: adult.id, action: "game_created", targetType: "game", targetId: createdGame.id, gameId: createdGame.id, metadata: { dataMode: "alpaca_iex" } });
    return [createdGame];
  });
  redirect(`/teacher/games/${game.id}`);
}

export async function addStudent(formData: FormData) {
  const { adult } = await requireTeacher();
  const parsed = z.object({
    gameId: z.string().uuid(),
    displayName: z.string().trim().min(2).max(60),
    username: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/),
    pin: z.string().regex(/^\d{4,8}$/),
  }).parse({
    gameId: formData.get("gameId"),
    displayName: formData.get("displayName"),
    username: formData.get("username"),
    pin: formData.get("pin"),
  });

  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, parsed.gameId), eq(games.ownerId, adult.id)))
    .limit(1);
  if (!game) throw new Error("Season not found.");
  const [classroom] = await db.select().from(classrooms).where(eq(classrooms.gameId, game.id)).limit(1);
  if (!classroom) throw new Error("Classroom not found.");
  const pinHash = await hashPin(parsed.pin);

  await db.transaction(async (tx) => {
    const [student] = await tx.insert(students).values({
      gameId: game.id,
      classroomId: classroom.id,
      displayName: parsed.displayName,
      username: parsed.username,
      pinHash,
      avatarKey: "sprout",
    }).returning();
    const [portfolio] = await tx.insert(portfolios).values({
      gameId: game.id,
      studentId: student.id,
      cashBalance: game.startingCash,
    }).returning();
    await tx.insert(cashLedger).values({
      portfolioId: portfolio.id,
      eventType: "season_deposit",
      amount: game.startingCash,
      runningBalance: game.startingCash,
      memo: "Opening simulated cash",
    });
    await tx.insert(auditEvents).values({
      actorType: "adult",
      actorId: adult.id,
      action: "student_created",
      targetType: "student",
      targetId: student.id,
      gameId: game.id,
      metadata: { username: parsed.username },
    });
  });

  revalidateTeacherGame(game.id);
}

export async function setSeasonStatus(formData: FormData) {
  const { adult } = await requireTeacher();
  const parsed = z.object({
    gameId: z.string().uuid(),
    status: z.enum(["active", "paused", "archived"]),
  }).parse({ gameId: formData.get("gameId"), status: formData.get("status") });
  const [game] = await db.update(games).set({ status: parsed.status, updatedAt: new Date() })
    .where(and(eq(games.id, parsed.gameId), eq(games.ownerId, adult.id)))
    .returning();
  if (!game) throw new Error("Season not found.");
  await db.insert(auditEvents).values({ actorType: "adult", actorId: adult.id, action: `game_${parsed.status}`, targetType: "game", targetId: game.id, gameId: game.id });
  revalidateTeacherGame(game.id);
}

export async function updateSeasonSettings(formData: FormData) {
  const parsed = z.object({
    gameId: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    maxPositionPercent: z.coerce.number().min(10).max(100),
    leaderboardVisibility: z.enum(["class_aliases", "teacher_only", "hidden"]),
  }).parse({
    gameId: formData.get("gameId"),
    name: formData.get("name"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    maxPositionPercent: formData.get("maxPositionPercent"),
    leaderboardVisibility: formData.get("leaderboardVisibility"),
  });
  if (parsed.endsAt <= parsed.startsAt) throw new Error("End date must be after the start date.");
  const { adult, game } = await requireOwnedGame(parsed.gameId);
  const config = {
    ...game.config,
    rationaleRequired: formData.get("rationaleRequired") === "on",
    leaderboardVisibility: parsed.leaderboardVisibility,
  };
  await db.transaction(async (tx) => {
    await tx.update(games).set({
      name: parsed.name,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      maxPositionPercent: String(parsed.maxPositionPercent),
      allowFractional: formData.get("allowFractional") === "on",
      config,
      updatedAt: new Date(),
    }).where(eq(games.id, game.id));
    await tx.insert(auditEvents).values({
      actorType: "adult",
      actorId: adult.id,
      action: "game_settings_updated",
      targetType: "game",
      targetId: game.id,
      gameId: game.id,
    });
  });
  revalidateTeacherGame(game.id);
}

export async function createAssignment(formData: FormData) {
  const parsed = z.object({
    gameId: z.string().uuid(),
    title: z.string().trim().min(3).max(120),
    instructions: z.string().trim().min(10).max(2000),
    type: z.enum(["reflection", "research", "comparison"]),
    dueAt: z.string().min(1),
  }).parse({
    gameId: formData.get("gameId"),
    title: formData.get("title"),
    instructions: formData.get("instructions"),
    type: formData.get("type"),
    dueAt: formData.get("dueAt"),
  });
  const { adult, game } = await requireOwnedGame(parsed.gameId);
  const dueAt = new Date(`${parsed.dueAt}T23:59:59`);
  if (Number.isNaN(dueAt.getTime())) throw new Error("Choose a valid due date.");
  const [assignment] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(assignments).values({
      gameId: game.id,
      classroomId: (await tx.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.gameId, game.id)).limit(1))[0]?.id,
      title: parsed.title,
      instructions: parsed.instructions,
      type: parsed.type,
      dueAt,
    }).returning();
    await tx.insert(auditEvents).values({ actorType: "adult", actorId: adult.id, action: "assignment_created", targetType: "assignment", targetId: created.id, gameId: game.id });
    return [created];
  });
  revalidateTeacherGame(game.id);
  revalidatePath("/app/assignments");
  redirect(`/teacher/games/${game.id}/assignments/${assignment.id}`);
}

export async function reviewAssignmentSubmission(formData: FormData) {
  const parsed = z.object({
    gameId: z.string().uuid(),
    assignmentId: z.string().uuid(),
    studentId: z.string().uuid(),
    feedback: z.string().trim().max(1200),
  }).parse({
    gameId: formData.get("gameId"),
    assignmentId: formData.get("assignmentId"),
    studentId: formData.get("studentId"),
    feedback: formData.get("feedback"),
  });
  const { adult, game } = await requireOwnedGame(parsed.gameId);
  const [assignment] = await db.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.id, parsed.assignmentId), eq(assignments.gameId, game.id))).limit(1);
  const [student] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, parsed.studentId), eq(students.gameId, game.id))).limit(1);
  if (!assignment || !student) throw new Error("Submission not found.");
  const [submission] = await db.update(assignmentSubmissions).set({
    teacherFeedback: parsed.feedback || null,
    status: "reviewed",
    reviewedAt: new Date(),
  }).where(and(eq(assignmentSubmissions.assignmentId, assignment.id), eq(assignmentSubmissions.studentId, student.id))).returning();
  if (!submission) throw new Error("This student has not submitted work yet.");
  await db.insert(auditEvents).values({ actorType: "adult", actorId: adult.id, action: "assignment_reviewed", targetType: "assignment", targetId: assignment.id, gameId: game.id, metadata: { studentId: student.id } });
  revalidateTeacherGame(game.id);
  revalidatePath("/app/assignments");
}

export async function setStudentStatus(formData: FormData) {
  const parsed = z.object({ gameId: z.string().uuid(), studentId: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse({
    gameId: formData.get("gameId"), studentId: formData.get("studentId"), status: formData.get("status"),
  });
  const { adult, game } = await requireOwnedGame(parsed.gameId);
  const [student] = await db.update(students).set({ status: parsed.status, updatedAt: new Date() }).where(and(eq(students.id, parsed.studentId), eq(students.gameId, game.id))).returning();
  if (!student) throw new Error("Student not found.");
  await db.insert(auditEvents).values({ actorType: "adult", actorId: adult.id, action: "student_status_changed", targetType: "student", targetId: student.id, gameId: game.id, metadata: { status: parsed.status } });
  revalidateTeacherGame(game.id);
}

export async function resetStudentPin(formData: FormData) {
  const parsed = z.object({ gameId: z.string().uuid(), studentId: z.string().uuid(), pin: z.string().regex(/^\d{4,8}$/) }).parse({
    gameId: formData.get("gameId"), studentId: formData.get("studentId"), pin: formData.get("pin"),
  });
  const { adult, game } = await requireOwnedGame(parsed.gameId);
  const [student] = await db.update(students).set({ pinHash: await hashPin(parsed.pin), updatedAt: new Date() }).where(and(eq(students.id, parsed.studentId), eq(students.gameId, game.id))).returning();
  if (!student) throw new Error("Student not found.");
  await db.insert(auditEvents).values({ actorType: "adult", actorId: adult.id, action: "student_pin_reset", targetType: "student", targetId: student.id, gameId: game.id });
  revalidateTeacherGame(game.id);
}

export async function setLessonAvailability(formData: FormData) {
  const parsed = z.object({ gameId: z.string().uuid(), lessonId: z.string().min(2).max(80) }).parse({ gameId: formData.get("gameId"), lessonId: formData.get("lessonId") });
  const { adult, game } = await requireOwnedGame(parsed.gameId);
  const lessonRows = await db.select({ id: lessons.id }).from(lessons);
  if (!lessonRows.some((lesson) => lesson.id === parsed.lessonId)) throw new Error("Lesson not found.");
  const current = Array.isArray(game.config.enabledLessonIds)
    ? new Set(game.config.enabledLessonIds.filter((value): value is string => typeof value === "string"))
    : new Set(lessonRows.map((lesson) => lesson.id));
  if (formData.get("enabled") === "true") current.add(parsed.lessonId);
  else current.delete(parsed.lessonId);
  await db.update(games).set({ config: { ...game.config, enabledLessonIds: [...current] }, updatedAt: new Date() }).where(eq(games.id, game.id));
  await db.insert(auditEvents).values({ actorType: "adult", actorId: adult.id, action: "lesson_availability_updated", targetType: "lesson", targetId: parsed.lessonId, gameId: game.id, metadata: { enabled: current.has(parsed.lessonId) } });
  revalidateTeacherGame(game.id);
  revalidatePath("/app/learn");
}
