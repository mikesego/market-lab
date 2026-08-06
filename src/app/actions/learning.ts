"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { assignmentSubmissions, assignments, auditEvents, journalEntries, lessonProgress, lessons } from "@/db/schema";
import { getStudentSession } from "@/lib/auth/student-session";
import { getEnabledLessonIds } from "@/lib/learning/config";

export async function completeLesson(formData: FormData) {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const lessonId = z.string().min(2).max(80).parse(formData.get("lessonId"));
  const lessonRows = await db.select({ id: lessons.id }).from(lessons);
  const [lesson] = lessonRows.filter((row) => row.id === lessonId);
  if (!lesson) throw new Error("Lesson not found.");
  if (!getEnabledLessonIds(session.gameConfig, lessonRows.map((row) => row.id)).has(lessonId)) throw new Error("This lesson is not assigned to your class.");
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
  await db.transaction(async (tx) => {
    const [entry] = await tx.insert(journalEntries).values({
      studentId: session.studentId,
      gameId: session.gameId,
      prompt: "What are you noticing, and what question will you investigate next?",
      thesis: parsed.thesis,
      confidence: parsed.confidence,
      tags: ["reflection"],
    }).returning();
    await tx.insert(auditEvents).values({ actorType: "student", actorId: session.studentId, action: "journal_created", targetType: "journal_entry", targetId: entry.id, gameId: session.gameId });
  });
  revalidatePath("/app/journal");
  revalidatePath(`/teacher/games/${session.gameId}`, "layout");
}

export async function resetLesson(formData: FormData) {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const lessonId = z.string().min(2).max(80).parse(formData.get("lessonId"));
  await db.update(lessonProgress).set({ status: "in_progress", updatedAt: new Date() }).where(and(eq(lessonProgress.studentId, session.studentId), eq(lessonProgress.lessonId, lessonId)));
  revalidatePath("/app/learn");
}

export async function submitAssignment(formData: FormData) {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const parsed = z.object({
    assignmentId: z.string().uuid(),
    response: z.string().trim().min(20).max(4000),
  }).parse({ assignmentId: formData.get("assignmentId"), response: formData.get("response") });
  const [assignment] = await db.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.id, parsed.assignmentId), eq(assignments.gameId, session.gameId))).limit(1);
  if (!assignment) throw new Error("Assignment not found.");
  await db.transaction(async (tx) => {
    await tx.insert(assignmentSubmissions).values({
      assignmentId: assignment.id,
      studentId: session.studentId,
      status: "submitted",
      response: { text: parsed.response },
      teacherFeedback: null,
      submittedAt: new Date(),
      reviewedAt: null,
    }).onConflictDoUpdate({
      target: [assignmentSubmissions.assignmentId, assignmentSubmissions.studentId],
      set: { status: "submitted", response: { text: parsed.response }, teacherFeedback: null, submittedAt: new Date(), reviewedAt: null },
    });
    await tx.insert(auditEvents).values({ actorType: "student", actorId: session.studentId, action: "assignment_submitted", targetType: "assignment", targetId: assignment.id, gameId: session.gameId });
  });
  revalidatePath("/app/assignments");
  revalidatePath("/app");
  revalidatePath(`/teacher/games/${session.gameId}`, "layout");
  redirect(`/app/assignments?submitted=${assignment.id}`);
}
