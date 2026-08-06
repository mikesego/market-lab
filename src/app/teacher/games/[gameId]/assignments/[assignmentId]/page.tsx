import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, MessageSquareText } from "lucide-react";
import { notFound } from "next/navigation";

import { reviewAssignmentSubmission } from "@/app/actions/teacher";
import { getTeacherWorkspace } from "@/lib/data/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentReviewPage({ params }: PageProps<"/teacher/games/[gameId]/assignments/[assignmentId]">) {
  const { gameId, assignmentId } = await params;
  const workspace = await getTeacherWorkspace(gameId);
  if (!workspace) notFound();
  const assignment = workspace.data.assignments.find((row) => row.id === assignmentId);
  if (!assignment) notFound();
  const submissions = new Map(assignment.submissions.map((submission) => [submission.studentId, submission]));
  return <>
    <Link className="button-quiet" href={`/teacher/games/${gameId}/assignments`} style={{ paddingLeft: 0 }}><ArrowLeft size={16} /> All assignments</Link>
    <div className="page-title"><div><span className="eyebrow">{assignment.type} assignment</span><h1>{assignment.title}</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>{assignment.instructions}</p></div><span className="status-pill"><CalendarDays size={13} />{assignment.dueAt ? `Due ${assignment.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}</span></div>
    <section className="teacher-review-summary"><div className="card stat-card"><span className="eyebrow">Submitted</span><strong>{assignment.submittedCount}/{workspace.data.roster.length}</strong><span className="muted">Student responses received</span></div><div className="card stat-card"><span className="eyebrow">Reviewed</span><strong>{assignment.reviewedCount}/{assignment.submittedCount}</strong><span className="muted">Responses with teacher review</span></div></section>
    <div className="teacher-submission-list">{workspace.data.roster.map((student) => {
      const submission = submissions.get(student.id);
      const response = submission?.response;
      const responseText = response && typeof response.text === "string" ? response.text : "";
      return <article className="card teacher-submission" key={student.id}><header><div><strong>{student.displayName}</strong><span className="muted">{student.username}</span></div><span className="status-pill">{submission ? submission.status === "reviewed" ? <CheckCircle2 size={13} /> : <Clock3 size={13} /> : <Clock3 size={13} />}{submission?.status ?? "not submitted"}</span></header>{submission ? <><div className="student-response"><span className="eyebrow">Student response</span><p>{responseText || "No written response was included."}</p><time className="muted">Submitted {submission.submittedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div><form action={reviewAssignmentSubmission} className="teacher-feedback-form"><input type="hidden" name="gameId" value={gameId} /><input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="studentId" value={student.id} /><div className="field"><label htmlFor={`feedback-${student.id}`}><MessageSquareText size={15} /> Teacher feedback</label><textarea className="textarea" id={`feedback-${student.id}`} name="feedback" maxLength={1200} defaultValue={submission.teacherFeedback ?? ""} placeholder="Name a strength, ask a question, or suggest one next step." /></div><button className="button-primary" type="submit">{submission.status === "reviewed" ? "Update review" : "Mark reviewed"}</button></form></> : <p className="empty-table-copy">No response yet. This student will see the assignment in their workspace.</p>}</article>;
    })}</div>
  </>;
}
