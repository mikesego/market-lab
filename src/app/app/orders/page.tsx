import Link from "next/link";
import { CircleCheck, Clock3, Plus, XCircle } from "lucide-react";

import { cancelStudentOrder, refreshStudentOrders } from "@/app/actions/trading";
import { getStudentPortfolioDTO } from "@/lib/data/student";
import { formatMoney } from "@/lib/utils";

export default async function OrdersPage({ searchParams }: PageProps<"/app/orders">) {
  const query = await searchParams;
  const portfolio = await getStudentPortfolioDTO();
  if (!portfolio) return null;
  return <>
    <div className="page-title"><div><span className="eyebrow">Order center</span><h1>Your orders</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>An order is a request. A fill is the completed simulated trade.</p></div><div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}><form action={refreshStudentOrders}><button className="button-secondary" type="submit"><Clock3 size={16} /> Check waiting orders</button></form><Link className="button-primary" href="/app/discover"><Plus size={17} /> New order</Link></div></div>
    {query.placed ? <div className="success-box" role="status" style={{ marginBottom: "1rem" }}><CircleCheck size={17} style={{ display: "inline", marginRight: 7 }} />Your {String(query.symbol)} order was {query.placed === "filled" ? "filled" : "accepted and is waiting"}.</div> : null}
    <div className="card table-card"><div className="table-header"><div><span className="eyebrow">Recent activity</span><h2 style={{ fontSize: "1.15rem", margin: ".35rem 0 0" }}>Submitted orders</h2></div></div><div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Investment</th><th>Side</th><th>Type</th><th>Shares</th><th>Submitted price</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{portfolio.orders.map((order) => <tr key={order.id}><td><strong>{order.symbol}</strong><span className="muted" style={{ display: "block", fontSize: ".7rem" }}>{order.name}</span></td><td style={{ textTransform: "capitalize", fontWeight: 800 }}>{order.side}</td><td style={{ textTransform: "capitalize" }}>{order.orderType}{order.limitPrice ? ` @ ${formatMoney(order.limitPrice)}` : ""}</td><td>{Number(order.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{formatMoney(order.submittedQuote)}</td><td><span className="status-pill">{["queued", "open"].includes(order.status) ? <Clock3 size={12} /> : order.status === "filled" ? <CircleCheck size={12} /> : <XCircle size={12} />}{order.status.replaceAll("_", " ")}</span></td><td>{order.submittedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td><td>{["queued", "open", "partially_filled"].includes(order.status) ? <form action={cancelStudentOrder}><input type="hidden" name="orderId" value={order.id} /><button className="button-quiet" type="submit">Cancel</button></form> : <span className="muted">—</span>}</td></tr>)}</tbody></table></div>{!portfolio.orders.length ? <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No orders yet.</p> : null}</div>
    <div className="info-box" style={{ marginTop: "1rem" }}>Orders placed outside the regular session queue for the next open. Limit orders fill only when their price condition is met; they can expire without a fill.</div>
  </>;
}
