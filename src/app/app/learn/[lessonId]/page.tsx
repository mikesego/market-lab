import Link from "next/link";
import { ArrowLeft, CheckCircle2, MessageCircleQuestion } from "lucide-react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { completeLesson } from "@/app/actions/learning";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { getStudentSession } from "@/lib/auth/student-session";
import { getEnabledLessonIds } from "@/lib/learning/config";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: PageProps<"/app/learn/[lessonId]">) {
  const { lessonId } = await params;
  const session = await getStudentSession();
  const [lesson, lessonRows] = await Promise.all([
    db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1).then((rows) => rows[0]),
    db.select({ id: lessons.id }).from(lessons),
  ]);
  if (!lesson) notFound();
  if (!session || !getEnabledLessonIds(session.gameConfig, lessonRows.map((row) => row.id)).has(lesson.id)) notFound();
  const content = lesson.content as { hook?: string; vocabulary?: string[]; check?: string };
  return <div style={{ maxWidth: 860, margin: "0 auto" }}><Link className="button-quiet" href="/app/learn" style={{ paddingLeft: 0 }}><ArrowLeft size={16} /> All learning labs</Link><header style={{ margin: "2rem 0" }}><span className="eyebrow">{lesson.concept} · {lesson.minutes} minutes</span><h1 className="display" style={{ fontSize: "clamp(3.5rem,8vw,6rem)", lineHeight: .9, margin: ".7rem 0 1rem" }}>{lesson.title}</h1><p className="muted" style={{ fontSize: "1.08rem", lineHeight: 1.7 }}>{lesson.summary}</p></header><article className="card-strong" style={{ padding: "clamp(1.5rem,5vw,3rem)" }}><span className="eyebrow">Core idea</span><p className="display" style={{ fontSize: "2.2rem", lineHeight: 1.25, margin: "1rem 0 2rem" }}>{content.hook}</p><h2 style={{ fontSize: "1.2rem" }}>Words to use precisely</h2><div style={{ display: "flex", flexWrap: "wrap", gap: ".6rem", margin: "1rem 0 2rem" }}>{content.vocabulary?.map((word) => <span className="status-pill" key={word}>{word}</span>)}</div><div className="info-box" style={{ padding: "1.2rem" }}><MessageCircleQuestion size={21} style={{ marginBottom: ".5rem" }} /><strong style={{ display: "block" }}>Check your thinking</strong><p style={{ marginBottom: 0, lineHeight: 1.65 }}>{content.check}</p></div><form action={completeLesson} style={{ marginTop: "1.5rem" }}><input type="hidden" name="lessonId" value={lesson.id} /><button className="button-primary" type="submit"><CheckCircle2 size={18} /> Mark complete</button></form></article><p className="muted" style={{ fontSize: ".76rem", lineHeight: 1.6, marginTop: "1.5rem" }}>Completing a lab updates your learning record and may unlock a recognition. It does not add money or change your leaderboard rank.</p></div>;
}
