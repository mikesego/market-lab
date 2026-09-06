import Link from "next/link";
import { count, desc, inArray } from "drizzle-orm";
import { Activity, ArrowLeft, Database, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";

import { Brand } from "@/components/brand";
import { db } from "@/db";
import { auditEvents, games, orders, studentSessions, students } from "@/db/schema";
import { requireOperator } from "@/lib/auth/teacher";
import { marketDataProvider } from "@/lib/market/provider";

export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  try {
    await requireOperator();
  } catch {
    notFound();
  }

  const [[studentCount], [gameCount], [sessionCount], [pendingCount], recentAudit] = await Promise.all([
    db.select({ value: count() }).from(students),
    db.select({ value: count() }).from(games),
    db.select({ value: count() }).from(studentSessions),
    db.select({ value: count() }).from(orders).where(inArray(orders.status, ["queued", "open", "partially_filled"])),
    db.select().from(auditEvents).orderBy(desc(auditEvents.occurredAt)).limit(12),
  ]);

  const stats = [
    ["Students", studentCount.value, UsersRound],
    ["Seasons", gameCount.value, Activity],
    ["Student sessions", sessionCount.value, ShieldCheck],
    ["Waiting orders", pendingCount.value, RefreshCw],
  ] as const;

  return (
    <main id="main-content" className="container-shell" style={{ padding: "2rem 0 6rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "4rem" }}>
        <Brand />
        <Link className="button-secondary" href="/teacher/games"><ArrowLeft size={16} /> Teacher workspace</Link>
      </header>
      <div className="page-title">
        <div><span className="eyebrow">Restricted operations</span><h1>System console</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>A read-only view of platform health and recent activity.</p></div>
        <span className="status-pill positive"><Database size={14} /> Database connected</span>
      </div>
      <section className="stat-grid" aria-label="System metrics">
        {stats.map(([label, value, Icon]) => <article className="card stat-card" key={label}><Icon size={20} /><span className="eyebrow" style={{ display: "block", marginTop: ".8rem" }}>{label}</span><strong>{value}</strong></article>)}
      </section>
      <section className="portfolio-layout">
        <article className="card table-card">
          <div className="table-header"><div><span className="eyebrow">Audit trail</span><h2 style={{ margin: ".35rem 0 0" }}>Recent events</h2></div></div>
          <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead><tbody>{recentAudit.map((event) => <tr key={event.id}><td>{event.occurredAt.toLocaleString()}</td><td>{event.actorType}</td><td>{event.action.replaceAll("_", " ")}</td><td>{event.targetType ?? "—"}</td></tr>)}</tbody></table></div>
        </article>
        <aside className="card" style={{ padding: "1.25rem", alignSelf: "start" }}>
          <span className="eyebrow">Market data</span>
          <h2 className="display" style={{ fontSize: "2rem", margin: ".6rem 0" }}>{marketDataProvider.label}</h2>
          <p className="muted" style={{ lineHeight: 1.6 }}>IEX market data for classroom simulation. Assigned tablets preserve saved prices and trades while offline.</p>
          <dl className="compact-list"><div className="compact-row"><dt>Provider ID</dt><dd>{marketDataProvider.id}</dd></div><div className="compact-row"><dt>Usage mode</dt><dd>{marketDataProvider.usageMode}</dd></div><div className="compact-row"><dt>Order matcher</dt><dd>Automatic · every minute</dd></div><div className="compact-row"><dt>Job endpoint</dt><dd>/api/jobs/market</dd></div></dl>
        </aside>
      </section>
    </main>
  );
}
