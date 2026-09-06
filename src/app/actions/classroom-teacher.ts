"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, classroomDevices, portfolios } from "@/db/schema";
import { requireTeacher } from "@/lib/auth/teacher";
import { getOwnedTeacherGame } from "@/lib/data/teacher";

export async function requestClassroomRefresh(form: FormData) {
  const gameId = z.string().uuid().parse(form.get("gameId"));
  const teacher = await requireTeacher();
  if (!await getOwnedTeacherGame(gameId, teacher.adult.id)) throw new Error("Season not found.");
  const classroomPortfolios = db.select({ id: portfolios.id }).from(portfolios).where(eq(portfolios.gameId, gameId));
  await db.update(classroomDevices).set({ refreshRequestedAt: new Date() }).where(and(inArray(classroomDevices.portfolioId, classroomPortfolios), eq(classroomDevices.active, true)));
  await db.insert(auditEvents).values({ actorType: "adult", actorId: teacher.adult.id, action: "classroom_refresh_requested", gameId });
  revalidatePath(`/teacher/games/${gameId}/devices`);
}
