import { Download, ListFilter } from "lucide-react";
import { notFound } from "next/navigation";

import { getTeacherWorkspace } from "@/lib/data/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherActivityPage({ params, searchParams }: PageProps<"/teacher/games/[gameId]/activity">) {
  const [{ gameId }, query] = await Promise.all([params, searchParams]);
  const workspace = await getTeacherWorkspace(gameId);
  if (!workspace) notFound();
  const student = typeof query.student === "string" ? query.student : "all";
  const kind = typeof query.kind === "string" ? query.kind : "all";
  const symbol = typeof query.symbol === "string" ? query.symbol.trim().toUpperCase() : "";
  const filtered = workspace.data.activity.filter((item) =>
    (student === "all" || item.studentId === student) &&
    (kind === "all" || item.kind === kind) &&
    (!symbol || item.symbol === symbol),
  );
  return <>
    <div className="page-title"><div><span className="eyebrow">Audit view</span><h1>Class activity</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>A real chronological record of sign-ins, orders, learning, journals, assignments, and teacher changes.</p></div><a className="button-secondary" href={`/teacher/games/${gameId}/exports/activity`}><Download size={16} /> Export activity</a></div>
    <form method="get" className="card teacher-filter-bar"><ListFilter size={18} /><strong>Filters</strong><label><span>Student</span><select className="select" name="student" defaultValue={student}><option value="all">All students</option>{workspace.data.roster.map((row) => <option value={row.id} key={row.id}>{row.displayName}</option>)}</select></label><label><span>Activity</span><select className="select" name="kind" defaultValue={kind}><option value="all">All activity</option><option value="order">Orders</option><option value="login">Sign-ins</option><option value="learning">Learning</option><option value="journal">Journals</option><option value="assignment">Assignments</option><option value="roster">Roster changes</option><option value="season">Season changes</option></select></label><label><span>Symbol</span><input className="input" name="symbol" defaultValue={symbol} placeholder="Any symbol" maxLength={10} /></label><button className="button-primary" type="submit">Apply</button><a className="button-quiet" href={`/teacher/games/${gameId}/activity`}>Clear</a></form>
    <section className="card table-card"><div className="table-header"><div><span className="eyebrow">Activity log</span><h2 style={{ margin: ".35rem 0 0" }}>{filtered.length} events</h2></div></div>{filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Person</th><th>Activity</th><th>Details</th><th>Type</th><th>Status</th><th>Time</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.studentName}</strong></td><td><strong>{item.title}</strong>{item.symbol ? <span className="muted table-subtext">{item.symbol}</span> : null}</td><td>{item.detail}</td><td><span className="status-pill">{item.kind}</span></td><td><span className="status-pill">{item.status}</span></td><td><time dateTime={item.occurredAt.toISOString()}>{item.occurredAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></td></tr>)}</tbody></table></div> : <div className="empty-state compact"><ListFilter size={28} /><h2>No matching activity</h2><p className="muted">Try clearing the filters. New student actions will appear here automatically.</p></div>}</section>
  </>;
}
