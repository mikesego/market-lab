import Link from "next/link";
import { ArrowRight, Award, BookOpenCheck, CheckCircle2, LockKeyhole } from "lucide-react";

import { getLearningDTO } from "@/lib/data/student";

export default async function LearnPage({ searchParams }: PageProps<"/app/learn">) {
  const query = await searchParams;
  const learning = await getLearningDTO();
  if (!learning) return null;
  const progress = Math.round(learning.completedCount / learning.lessons.length * 100);
  return <>
    <div className="page-title"><div><span className="eyebrow">Learning labs</span><h1>Build your market toolkit</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Real vocabulary, short explanations, and questions worth discussing.</p></div></div>
    {query.completed ? <div className="success-box" role="status" style={{ marginBottom: "1rem" }}><CheckCircle2 size={17} style={{ display: "inline", marginRight: 7 }} />Lesson complete. Your learning record is updated; your financial rank is unchanged.</div> : null}
    <div className="card" style={{ padding: "1.2rem", marginBottom: "1rem", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "1rem", alignItems: "center" }}><span style={{ width: "3rem", height: "3rem", borderRadius: ".7rem", background: "var(--lime)", display: "grid", placeItems: "center", border: "1px solid var(--ink)" }}><BookOpenCheck /></span><div><strong>{learning.completedCount} of {learning.lessons.length} labs complete</strong><div className="progress-track" style={{ marginTop: ".55rem" }}><span style={{ width: `${progress}%` }} /></div></div><strong>{progress}%</strong></div>
    <div className="lesson-grid">{learning.lessons.map((lesson, index) => { const complete = lesson.progress?.status === "completed"; const available = index <= learning.completedCount; return <article key={lesson.id} className="card lesson-card"><div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="status-pill">{complete ? <CheckCircle2 size={13} /> : available ? <BookOpenCheck size={13} /> : <LockKeyhole size={13} />}{complete ? "Complete" : available ? `${lesson.minutes} min` : "Next up"}</span><span className="eyebrow">Lab {lesson.position}</span></div><h2 className="display" style={{ fontSize: "2rem", margin: "1rem 0 .45rem" }}>{lesson.title}</h2><p className="muted" style={{ fontSize: ".84rem", lineHeight: 1.6 }}>{lesson.summary}</p></div>{available ? <Link className={complete ? "button-secondary" : "button-primary"} href={`/app/learn/${lesson.id}`}>{complete ? "Review lab" : "Start lab"}<ArrowRight size={16} /></Link> : <span className="muted" style={{ fontSize: ".76rem" }}>Complete the earlier lab first.</span>}</article>; })}</div>
    <section style={{ marginTop: "2rem" }}><div className="page-title" style={{ marginBottom: "1rem" }}><div><span className="eyebrow">Separate from standings</span><h2 className="display" style={{ fontSize: "2.4rem", margin: ".3rem 0" }}>Learning recognitions</h2></div></div><div className="discover-grid">{learning.achievements.map((award) => <div className="card" style={{ padding: "1.1rem" }} key={award.id}><Award size={24} /><strong style={{ display: "block", margin: ".7rem 0 .3rem" }}>{award.name}</strong><p className="muted" style={{ fontSize: ".78rem", lineHeight: 1.55 }}>{award.description}</p></div>)}</div></section>
  </>;
}
