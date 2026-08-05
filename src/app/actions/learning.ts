"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { auditEvents, journalEntries, lessonProgress, lessons } from "@/db/schema";
import { getStudentSession } from "@/lib/auth/student-session";

export async function completeLesson(formData: FormData) {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const lessonId = z.string().min(2).max(80).parse(formData.get("lessonId"));
  const [lesson] = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) throw new Error("Lesson not found.");
  await db.transaction(async (tx) => {
    await tx
      .insert(lessonProgress)
      .values({ studentId: session.studentId, lessonId, status: "completed", score: 100, attempts: 1, completedAt: new Date() })
      .onConflictDoUpdate({
        target: [lessonProgress.studentId, lessonProgress.lessonId],
        set: { status: "completed", score: 100, completedAt: new Date(), updatedAt: new Date() },
      });
    await tx.insert(auditEvents).values({ actorType: "student", actorId: session.studentId, action: "lesson_completed", targetType: "lesson", targetId: lessonId, gameId: session.gameId });
  });
  revalidatePath("/app/learn");
  redirect(`/app/learn?completed=${lessonId}`);
}

export async function addJournalEntry(formData: FormData) {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const parsed = z.object({
    thesis: z.string().trim().min(20).max(1200),
    confidence: z.coerce.number().int().min(1).max(5),
  }).parse({ thesis: formData.get("thesis"), confidence: formData.get("confidence") });
  await db.insert(journalEntries).values({
    studentId: session.studentId,
    gameId: session.gameId,
    prompt: "What are you noticing, and what question will you investigate next?",
    thesis: parsed.thesis,
    confidence: parsed.confidence,
    tags: ["reflection"],
  });
  revalidatePath("/app/journal");
}

export async function resetLesson(formData: FormData) {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const lessonId = z.string().min(2).max(80).parse(formData.get("lessonId"));
  await db.update(lessonProgress).set({ status: "in_progress", updatedAt: new Date() }).where(and(eq(lessonProgress.studentId, session.studentId), eq(lessonProgress.lessonId, lessonId)));
  revalidatePath("/app/learn");
}
