import { Download, GraduationCap, Trophy } from "lucide-react";

import { getTeacherGameDTO } from "@/lib/data/teacher";
import { formatMoney, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeacherReportsPage() {
  const data = await getTeacherGameDTO();
  if (!data) return null;
  return <><div className="page-title"><div><span className="eyebrow">Separate, understandable evidence</span><h1>Reports</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Financial performance and learning progress answer different questions, so they stay in different reports.</p></div><button className="button-secondary" type="button"><Download size={16} /> Export report pack</button></div><div className="lesson-grid" style={{ marginBottom: "1rem" }}><div className="card" style={{ padding: "1.3rem" }}><Trophy size={25} /><h2 className="display" style={{ fontSize: "2.1rem", margin: ".7rem 0 .4rem" }}>Financial standings</h2><p className="muted" style={{ lineHeight: 1.6, fontSize: ".84rem" }}>Ending portfolio equity, total return, cash, holdings, and trade activity. No learning modifier.</p></div><div className="card" style={{ padding: "1.3rem" }}><GraduationCap size={25} /><h2 className="display" style={{ fontSize: "2.1rem", margin: ".7rem 0 .4rem" }}>Learning evidence</h2><p className="muted" style={{ lineHeight: 1.6, fontSize: ".84rem" }}>Lesson completion, checks, journal activity, reflections, assignments, and teacher recognitions.</p></div></div><div className="card table-card"><div className="table-header"><div><span className="eyebrow">Current snapshot</span><h2 style={{ margin: ".35rem 0 0" }}>Class report</h2></div></div><table className="data-table"><thead><tr><th>Student</th><th>Financial rank</th><th>Portfolio value</th><th>Return</th><th>Labs complete</th><th>Journal entries</th></tr></thead><tbody>{data.roster.sort((a,b) => (a.rank ?? 99) - (b.rank ?? 99)).map((student) => <tr key={student.id}><td><strong>{student.displayName}</strong></td><td>#{student.rank}</td><td>{formatMoney(student.equity)}</td><td className={student.returnPercent >= 0 ? "positive" : "negative"}>{formatPercent(student.returnPercent)}</td><td>{student.lessonsCompleted}/{data.lessons.length}</td><td>{student.journalCount}</td></tr>)}</tbody></table></div></>;
}
