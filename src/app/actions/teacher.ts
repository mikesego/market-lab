"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import {
  auditEvents,
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

  revalidatePath(`/teacher/games/${game.id}`);
}

export async function setSeasonStatus(formData: FormData) {
  const { adult } = await requireTeacher();
  const parsed = z.object({
    gameId: z.string().uuid(),
    status: z.enum(["active", "paused"]),
  }).parse({ gameId: formData.get("gameId"), status: formData.get("status") });
  const [game] = await db.update(games).set({ status: parsed.status, updatedAt: new Date() })
    .where(and(eq(games.id, parsed.gameId), eq(games.ownerId, adult.id)))
    .returning();
  if (!game) throw new Error("Season not found.");
  await db.insert(auditEvents).values({ actorType: "adult", actorId: adult.id, action: `game_${parsed.status}`, targetType: "game", targetId: game.id, gameId: game.id });
  revalidatePath(`/teacher/games/${game.id}`);
}
