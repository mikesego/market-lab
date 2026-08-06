import Link from "next/link";
import { BookOpenCheck, CalendarDays, CheckCircle2, ClipboardPlus, FileText, Power } from "lucide-react";
import { notFound } from "next/navigation";

import { createAssignment, setLessonAvailability } from "@/app/actions/teacher";
import { getTeacherWorkspace } from "@/lib/data/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentsPage({ params }: PageProps<"/teacher/games/[gameId]/assignments">) {
  const { gameId } = await params;
  const workspace = await getTeacherWorkspace(gameId);
  if (!workspace) notFound();
  const { data } = workspace;
  const suggestedPrompts = [
    ["Compare an ETF with one company", "Choose one broad-market ETF and one company. Compare what each owns, two risks, and which evidence matters most."],
    ["Revisit a decision after new evidence", "Describe your original reasoning, identify new evidence, and explain whether you would keep, revise, or reverse the decision."],
    ["Explain one risk the price does not show", "Choose a holding and explain a business, concentration, or uncertainty risk that cannot be learned from today's price alone."],
  ];
  return <>
    <div className="page-title"><div><span className="eyebrow">Learning work</span><h1>Assignments & lessons</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Ask students to explain, compare, and revise—not to predict perfectly.</p></div></div>
    <div className="teacher-assignment-layout">
      <section><div className="section-heading-inline"><div><span className="eyebrow">Assigned work</span><h2>{data.assignments.length} assignments</h2></div></div>{data.assignments.length ? <div className="lesson-grid">{data.assignments.map((assignment) => <article className="card lesson-card" key={assignment.id}><div><div className="assignment-card-heading"><span className="status-pill"><FileText size={13} />{assignment.type}</span><span className="muted" style={{ fontSize: ".72rem" }}><CalendarDays size={13} style={{ display: "inline", marginRight: 4 }} />{assignment.dueAt ? `Due ${assignment.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}</span></div><h2 className="display" style={{ fontSize: "2rem", margin: "1rem 0 .45rem" }}>{assignment.title}</h2><p className="muted" style={{ fontSize: ".84rem", lineHeight: 1.6 }}>{assignment.instructions}</p></div><div className="assignment-card-footer"><span className={assignment.submittedCount ? "positive" : "muted"}><CheckCircle2 size={15} />{assignment.submittedCount} of {data.roster.length} submitted · {assignment.reviewedCount} reviewed</span><Link className="button-secondary" href={`/teacher/games/${gameId}/assignments/${assignment.id}`}>Review work</Link></div></article>)}</div> : <div className="card empty-state compact"><ClipboardPlus size={28} /><h2>No assignments yet</h2><p className="muted">Use the form to create written work that students can submit from their workspace.</p></div>}
      <section className="teacher-lessons-section"><span className="eyebrow">Student learning library</span><h2>Available lessons</h2><p className="muted">Turn individual labs on or off. Disabled lessons disappear from student accounts; existing completion records remain intact.</p><div className="teacher-lesson-list">{data.lessons.map((lesson) => <article className="card teacher-lesson-row" key={lesson.id}><BookOpenCheck size={20} /><div><strong>{lesson.title}</strong><span className="muted">{lesson.concept} · {lesson.minutes} min</span></div><form action={setLessonAvailability}><input type="hidden" name="gameId" value={gameId} /><input type="hidden" name="lessonId" value={lesson.id} /><input type="hidden" name="enabled" value={lesson.enabled ? "false" : "true"} /><button className={lesson.enabled ? "button-secondary" : "button-quiet"} type="submit"><Power size={15} /> {lesson.enabled ? "Available" : "Turn on"}</button></form></article>)}</div></section>
      </section>
      <aside className="card teacher-form-card teacher-assignment-form"><span className="eyebrow">Create learning work</span><h2 className="display">New assignment</h2><form action={createAssignment} className="stacked-form"><input type="hidden" name="gameId" value={gameId} /><div className="field"><label htmlFor="title">Title</label><input className="input" id="title" name="title" required minLength={3} maxLength={120} placeholder="Explain one portfolio decision" /></div><div className="field"><label htmlFor="type">Assignment type</label><select className="select" id="type" name="type" defaultValue="reflection"><option value="reflection">Reflection</option><option value="research">Research</option><option value="comparison">Comparison</option></select></div><div className="field"><label htmlFor="dueAt">Due date</label><input className="input" id="dueAt" name="dueAt" type="date" required /></div><div className="field"><label htmlFor="instructions">Student instructions</label><textarea className="textarea" id="instructions" name="instructions" required minLength={10} maxLength={2000} placeholder="What should students explain? Name the evidence and reasoning you want to see." /></div><button className="button-primary" type="submit"><ClipboardPlus size={17} /> Create assignment</button></form><div className="prompt-bank"><span className="eyebrow">Prompt bank</span>{suggestedPrompts.map(([title, instructions]) => <details key={title}><summary>{title}</summary><p>{instructions}</p></details>)}</div></aside>
    </div>
  </>;
}
