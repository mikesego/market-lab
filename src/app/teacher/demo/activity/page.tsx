import { Clock3, Download, ListFilter } from "lucide-react";

import { getTeacherGameDTO } from "@/lib/data/teacher";

export const dynamic = "force-dynamic";

export default async function TeacherActivityPage() {
  const data = await getTeacherGameDTO();
  if (!data) return null;
  return <><div className="page-title"><div><span className="eyebrow">Audit view</span><h1>Class activity</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>A chronological view of simulated order requests and outcomes.</p></div><button className="button-secondary" type="button"><Download size={16} /> Export activity</button></div><div className="card" style={{ padding: ".8rem 1rem", display: "flex", gap: ".7rem", alignItems: "center", marginBottom: "1rem" }}><ListFilter size={18} /><strong style={{ fontSize: ".8rem" }}>Filters:</strong>{["All students", "All statuses", "All symbols"].map((label) => <button className="button-quiet" type="button" key={label}>{label} ▾</button>)}</div><div className="card table-card"><table className="data-table"><thead><tr><th>Student</th><th>Order</th><th>Investment</th><th>Shares</th><th>Status</th><th>Time</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id}><td><strong>{order.displayName}</strong></td><td style={{ textTransform: "capitalize" }}>{order.side} · {order.type}</td><td><strong>{order.symbol}</strong></td><td>{Number(order.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td><span className="status-pill"><Clock3 size={12} />{order.status}</span></td><td>{order.submittedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td></tr>)}</tbody></table></div></>;
}
