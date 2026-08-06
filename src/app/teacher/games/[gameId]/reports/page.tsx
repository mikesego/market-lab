import { Download, GraduationCap, Trophy } from "lucide-react";
import { notFound } from "next/navigation";

import { getTeacherWorkspace } from "@/lib/data/teacher-workspace";
import { formatMoney, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeacherReportsPage({ params }: PageProps<"/teacher/games/[gameId]/reports">) {
  const { gameId } = await params;
  const workspace = await getTeacherWorkspace(gameId);
  if (!workspace) notFound();
  const { data } = workspace;
  const submittedByStudent = new Map<string, number>();
  for (const submission of data.submissions) submittedByStudent.set(submission.studentId, (submittedByStudent.get(submission.studentId) ?? 0) + 1);
  return <>
    <div className="page-title"><div><span className="eyebrow">Separate, understandable evidence</span><h1>Reports</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Financial performance and learning progress answer different questions, so they remain separate.</p></div><a className="button-secondary" href={`/teacher/games/${gameId}/exports/report`}><Download size={16} /> Export report CSV</a></div>
    <div className="lesson-grid" style={{ marginBottom: "1rem" }}><div className="card report-explainer"><Trophy size={25} /><h2 className="display">Financial standings</h2><p className="muted">Portfolio value and total return determine rank. Lessons, journals, and assignments never modify it.</p></div><div className="card report-explainer"><GraduationCap size={25} /><h2 className="display">Learning evidence</h2><p className="muted">Lesson completion, journals, assignments, and feedback show engagement and reasoning separately.</p></div></div>
    <section className="card table-card"><div className="table-header"><div><span className="eyebrow">Current snapshot</span><h2 style={{ margin: ".35rem 0 0" }}>Class report</h2></div></div>{data.roster.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Student</th><th>Financial rank</th><th>Portfolio value</th><th>Return</th><th>Labs complete</th><th>Journal entries</th><th>Assignments</th><th>Last active</th></tr></thead><tbody>{data.roster.slice().sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).map((student) => <tr key={student.id}><td><strong>{student.displayName}</strong></td><td>{student.rank ? `#${student.rank}` : "—"}</td><td>{formatMoney(student.equity)}</td><td className={student.returnPercent >= 0 ? "positive" : "negative"}>{formatPercent(student.returnPercent)}</td><td>{student.lessonsCompleted}/{data.activeLessons.length}</td><td>{student.journalCount}</td><td>{submittedByStudent.get(student.id) ?? 0}/{data.assignments.length}</td><td>{student.lastSeenAt ? student.lastSeenAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never"}</td></tr>)}</tbody></table></div> : <p className="empty-table-copy">Add students to begin building the class report.</p>}</section>
    <section className="teacher-report-notes"><div className="card"><span className="eyebrow">Method</span><h3>How rank is calculated</h3><p className="muted">Rank sorts current simulated portfolio equity from highest to lowest. Total return compares current equity with this season’s starting cash of {formatMoney(Number(data.game.startingCash))}.</p></div><div className="card"><span className="eyebrow">Current totals</span><h3>{data.stats.orders} orders · {data.stats.lessonsComplete} labs</h3><p className="muted">{data.submissions.length} assignment submissions and {data.roster.reduce((sum, student) => sum + student.journalCount, 0)} journal entries are recorded.</p></div></section>
  </>;
}
