import Link from "next/link";
import { CircleCheck, Clock3, Plus, RefreshCw, XCircle } from "lucide-react";

import { cancelStudentOrder, refreshStudentOrders } from "@/app/actions/trading";
import { OrderStatusRefresher } from "@/components/order-status-refresher";
import { getStudentPortfolioDTO } from "@/lib/data/student";
import { formatMoney } from "@/lib/utils";

const waitingStatuses = ["queued", "open", "partially_filled"];

export default async function OrdersPage({ searchParams }: PageProps<"/app/orders">) {
  const query = await searchParams;
  const portfolio = await getStudentPortfolioDTO();
  if (!portfolio) return null;
  const hasWaitingOrders = portfolio.orders.some((order) => waitingStatuses.includes(order.status));

  return <>
    <OrderStatusRefresher enabled={hasWaitingOrders} />
    <div className="page-title">
      <div>
        <span className="eyebrow">Order center</span>
        <h1>Your orders</h1>
        <p className="muted" style={{ margin: ".6rem 0 0" }}>An order is a request. A fill is the completed simulated trade.</p>
      </div>
      <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
        <form action={refreshStudentOrders}>
          <button className="button-secondary" type="submit"><RefreshCw size={16} /> Refresh status</button>
        </form>
        <Link className="button-primary" href="/app/discover"><Plus size={17} /> New order</Link>
      </div>
    </div>
    {query.placed ? <div className="success-box" role="status" style={{ marginBottom: "1rem" }}>
      <CircleCheck size={17} style={{ display: "inline", marginRight: 7 }} />
      Your {String(query.symbol)} order was {query.placed === "filled" ? "filled" : "accepted and will be checked automatically"}.
    </div> : null}
    <div className="card table-card">
      <div className="table-header"><div><span className="eyebrow">Recent activity</span><h2 style={{ fontSize: "1.15rem", margin: ".35rem 0 0" }}>Submitted orders</h2></div></div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Investment</th><th>Side</th><th>Type</th><th>Shares</th><th>Submitted price</th><th>Fill price</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
          <tbody>{portfolio.orders.map((order) => <tr key={order.id}>
            <td><strong>{order.symbol}</strong><span className="muted" style={{ display: "block", fontSize: ".7rem" }}>{order.name}</span></td>
            <td style={{ textTransform: "capitalize", fontWeight: 800 }}>{order.side}</td>
            <td style={{ textTransform: "capitalize" }}>{order.orderType}{order.limitPrice ? ` @ ${formatMoney(order.limitPrice)}` : ""}</td>
            <td>{Number(order.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
            <td>{formatMoney(order.submittedQuote)}</td>
            <td>{order.fillPrice ? <><strong>{formatMoney(order.fillPrice)}</strong>{order.executedAt ? <span className="muted" style={{ display: "block", fontSize: ".7rem" }}>{order.executedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> : null}</> : <span className="muted">—</span>}</td>
            <td title={order.rejectionMessage ?? undefined}><span className="status-pill">{waitingStatuses.includes(order.status) ? <Clock3 size={12} /> : order.status === "filled" ? <CircleCheck size={12} /> : <XCircle size={12} />}{order.status.replaceAll("_", " ")}</span></td>
            <td>{order.submittedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
            <td>{waitingStatuses.includes(order.status) ? <form action={cancelStudentOrder}><input type="hidden" name="orderId" value={order.id} /><button className="button-quiet" type="submit">Cancel</button></form> : <span className="muted">—</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!portfolio.orders.length ? <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No orders yet.</p> : null}
    </div>
    <div className="info-box" style={{ marginTop: "1rem" }}>Waiting orders are checked automatically about once per minute during the regular session. Market orders fill at the next eligible live price. Limit orders remain open until the price condition is met, you cancel them, or the season ends.</div>
  </>;
}
