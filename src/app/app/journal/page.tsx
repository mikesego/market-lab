import { Brain, Lightbulb, NotebookPen } from "lucide-react";

import { addJournalEntry } from "@/app/actions/learning";
import { getStudentPortfolioDTO } from "@/lib/data/student";

export default async function JournalPage() {
  const portfolio = await getStudentPortfolioDTO();
  if (!portfolio) return null;
  return <>
    <div className="page-title"><div><span className="eyebrow">Decision journal</span><h1>Remember what you thought</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Keep the reasoning beside the result so hindsight cannot rewrite the story.</p></div></div>
    <div className="portfolio-layout">
      <section className="side-stack">{portfolio.journals.length ? portfolio.journals.map((entry) => <article className="card" style={{ padding: "1.3rem" }} key={entry.id}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}><span className="eyebrow">{entry.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</span><span className="status-pill"><Brain size={13} /> Confidence {entry.confidence}/5</span></div><p className="display" style={{ fontSize: "1.65rem", lineHeight: 1.35, margin: "1rem 0" }}>“{entry.thesis}”</p><div style={{ display: "flex", gap: ".45rem", flexWrap: "wrap" }}>{entry.tags.map((tag) => <span className="status-pill" key={tag}>{tag}</span>)}</div></article>) : <div className="card" style={{ padding: "2rem", textAlign: "center" }}><NotebookPen size={32} style={{ margin: "0 auto" }} /><p>Your first reflection will appear here.</p></div>}</section>
      <aside className="side-stack"><form action={addJournalEntry} className="card" style={{ padding: "1.3rem", display: "grid", gap: "1rem" }}><span className="eyebrow">New reflection</span><h2 className="display" style={{ fontSize: "2rem", margin: 0 }}>What are you noticing?</h2><div className="field"><label htmlFor="thesis">Observation and next question</label><textarea className="textarea" id="thesis" name="thesis" minLength={20} maxLength={1200} placeholder="I noticed… I want to investigate… Evidence that would change my view is…" required /></div><div className="field"><label htmlFor="confidence">Confidence (1–5)</label><input id="confidence" name="confidence" type="range" min="1" max="5" defaultValue="3" /></div><button className="button-primary" type="submit"><NotebookPen size={17} /> Save reflection</button></form><div className="card" style={{ padding: "1.2rem", background: "#fff4d7" }}><Lightbulb size={20} /><strong style={{ display: "block", margin: ".6rem 0 .3rem" }}>Try this sentence</strong><p className="muted" style={{ lineHeight: 1.6, fontSize: ".8rem" }}>“I expected ___ because ___. What happened was ___. The part of my reasoning I would keep or change is ___.”</p></div></aside>
    </div>
  </>;
}
