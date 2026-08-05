import { Download, KeyRound, Printer, UserPlus } from "lucide-react";

import { getTeacherGameDTO } from "@/lib/data/teacher";
import { formatMoney, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeacherRosterPage() {
  const data = await getTeacherGameDTO();
  if (!data) return null;
  return <><div className="page-title"><div><span className="eyebrow">Class management</span><h1>Roster & login cards</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Pseudonymous accounts keep student access simple and avoid collecting student email.</p></div><div style={{ display: "flex", gap: ".6rem" }}><button className="button-secondary" type="button"><Printer size={16} /> Print cards</button><button className="button-primary" type="button"><UserPlus size={16} /> Add students</button></div></div><div className="info-box" style={{ marginBottom: "1rem" }}><KeyRound size={17} style={{ display: "inline", marginRight: 7 }} />Demo login: class code <strong>OAK-724</strong>, any listed username, PIN <strong>2468</strong>. Production PINs are unique and only hashes are stored.</div><div className="card table-card"><div className="table-header"><div><span className="eyebrow">{data.classroom?.name}</span><h2 style={{ margin: ".35rem 0 0" }}>{data.roster.length} students</h2></div><button className="button-quiet" type="button"><Download size={16} /> Export CSV</button></div><div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Student</th><th>Username</th><th>Status</th><th>Portfolio</th><th>Return</th><th>Labs</th><th>Journal</th></tr></thead><tbody>{data.roster.map((student) => <tr key={student.id}><td><strong>{student.displayName}</strong></td><td><code>{student.username}</code></td><td><span className="status-pill">{student.status}</span></td><td>{formatMoney(student.equity)}</td><td className={student.returnPercent >= 0 ? "positive" : "negative"}>{formatPercent(student.returnPercent)}</td><td>{student.lessonsCompleted}/{data.lessons.length}</td><td>{student.journalCount}</td></tr>)}</tbody></table></div></div></>;
}
