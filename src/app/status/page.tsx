import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { PublicInfoPage } from "@/components/public-info-page";

export const metadata: Metadata = { title: "System status" };
export default function StatusPage() {
  return <PublicInfoPage eyebrow="System status" title="Development systems are operational." intro="This page reports the mode and readiness of the current demonstration environment."><div style={{ maxWidth: 800, display: "grid", gap: "1rem" }}>
    <StatusRow name="Web application" detail="Vercel development and production runtime" ready />
    <StatusRow name="Database" detail="Lakebase Postgres via Neon" ready />
    <StatusRow name="Adult authentication" detail="Clerk development instance" ready />
    <StatusRow name="Market data" detail="Deterministic replay provider active; licensed production feed not yet connected" ready={false} />
    <p className="muted" style={{ marginTop: "1rem", lineHeight: 1.7 }}>Real-student launch remains gated on a licensed market-data agreement, formal privacy/legal review, production communications setup, and final operator acceptance.</p>
  </div></PublicInfoPage>;
}
function StatusRow({ name, detail, ready }: { name: string; detail: string; ready: boolean }) {
  return <div className="card" style={{ padding: "1.1rem 1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}><div><strong>{name}</strong><p className="muted" style={{ margin: ".25rem 0 0", fontSize: ".84rem" }}>{detail}</p></div><span className={ready ? "positive" : "negative"} style={{ display: "inline-flex", gap: ".4rem", alignItems: "center", fontSize: ".75rem", fontWeight: 800 }}>{ready ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}{ready ? "Operational" : "Development only"}</span></div>;
}
