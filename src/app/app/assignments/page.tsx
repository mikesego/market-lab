import Link from "next/link";
import { CalendarDays, CheckCircle2, ClipboardPen, MessageSquareText } from "lucide-react";

import { submitAssignment } from "@/app/actions/learning";
import { getStudentAssignmentsDTO } from "@/lib/data/student";

export const dynamic = "force-dynamic";

export default async function StudentAssignmentsPage({ searchParams }: PageProps<"/app/assignments">) {
  const [data, query] = await Promise.all([getStudentAssignmentsDTO(), searchParams]);
  if (!data) return null;
  return <>
    <div className="page-title"><div><span className="eyebrow">Teacher-assigned work</span><h1>Assignments</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Explain your evidence and reasoning. Your answers never change your financial ranking.</p></div></div>
    {query.submitted ? <div className="success-box" role="status" style={{ marginBottom: "1rem" }}><CheckCircle2 size={17} style={{ display: "inline", marginRight: 7 }} />Your response was submitted to your teacher.</div> : null}
    {data.assignments.length ? <div className="lesson-grid">{data.assignments.map((assignment) => {
      const response = assignment.submission?.response;
      const responseText = response && typeof response.text === "string" ? response.text : "";
      return <article className="card assignment-card" key={assignment.id}>
        <div className="assignment-card-heading"><span className="status-pill">{assignment.submission ? <CheckCircle2 size={13} /> : <ClipboardPen size={13} />}{assignment.submission?.status ?? "to do"}</span><span className="muted" style={{ fontSize: ".72rem" }}><CalendarDays size={13} style={{ display: "inline", marginRight: 4 }} />{assignment.dueAt ? `Due ${assignment.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}</span></div>
        <h2 className="display" style={{ fontSize: "2rem", margin: "1rem 0 .45rem" }}>{assignment.title}</h2>
        <p className="muted" style={{ fontSize: ".84rem", lineHeight: 1.65 }}>{assignment.instructions}</p>
        {assignment.submission?.teacherFeedback ? <div className="info-box" style={{ margin: "1rem 0" }}><MessageSquareText size={16} style={{ display: "inline", marginRight: 6 }} /><strong>Teacher feedback:</strong> {assignment.submission.teacherFeedback}</div> : null}
        <form action={submitAssignment} className="assignment-response-form"><input type="hidden" name="assignmentId" value={assignment.id} /><div className="field"><label htmlFor={`response-${assignment.id}`}>{assignment.submission ? "Revise your response" : "Your response"}</label><textarea className="textarea" id={`response-${assignment.id}`} name="response" required minLength={20} maxLength={4000} defaultValue={responseText} placeholder="Use specific evidence. Explain what you considered and what risk remains." /></div><button className="button-primary" type="submit">{assignment.submission ? "Resubmit response" : "Submit response"}</button></form>
      </article>;
    })}</div> : <section className="card empty-state"><ClipboardPen size={30} /><h2>No assignments yet</h2><p className="muted">Your teacher has not assigned any written work. You can keep learning or record an idea in your journal.</p><div className="empty-state-actions"><Link className="button-primary" href="/app/learn">Continue learning</Link><Link className="button-secondary" href="/app/journal">Open journal</Link></div></section>}
  </>;
}
