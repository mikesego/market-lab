import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Lightbulb, WalletCards } from "lucide-react";

import { HoldingTable } from "@/components/holding-table";
import { PortfolioChart } from "@/components/portfolio-chart";
import { getLeaderboardDTO, getStudentPortfolioDTO } from "@/lib/data/student";
import { formatMoney, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const portfolio = await getStudentPortfolioDTO();
  if (!portfolio) return null;
  const leaderboard = await getLeaderboardDTO(portfolio.session.gameId);
  const currentRank = leaderboard.find((row) => row.studentId === portfolio.session.studentId);
  return (
    <>
      <div className="page-title">
        <div><span className="eyebrow">Wednesday, August 5</span><h1>Good afternoon, {portfolio.session.displayName.split(" ")[0]}.</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Your portfolio is ready. What deserves your attention today?</p></div>
        <Link className="button-primary" href="/app/discover">Research an idea <ArrowRight size={17} /></Link>
      </div>

      <section className="stat-grid" aria-label="Portfolio summary">
        <div className="card stat-card" style={{ background: "var(--ink)", color: "white", gridRow: "span 2" }}>
          <span className="eyebrow" style={{ color: "#b8e6ef" }}>Portfolio value</span>
          <strong style={{ fontSize: "clamp(2.3rem,5vw,4rem)" }}>{formatMoney(portfolio.summary.equity)}</strong>
          <span className={portfolio.summary.totalGain >= 0 ? "positive" : "negative"} style={{ display: "block", marginTop: ".35rem", color: portfolio.summary.totalGain >= 0 ? "var(--lime)" : "#ffb2a2", fontWeight: 850 }}>{formatMoney(portfolio.summary.totalGain)} · {formatPercent(portfolio.summary.totalReturnPercent)} since start</span>
          <PortfolioChart currentValue={portfolio.summary.equity} />
          <p style={{ color: "#b9cbc5", fontSize: ".72rem", margin: 0 }}>Replay values are educational fixtures and may not match today’s market.</p>
        </div>
        <Stat label="Available cash" value={formatMoney(portfolio.summary.availableCash)} note={portfolio.summary.reservedCash ? `${formatMoney(portfolio.summary.reservedCash)} reserved` : "Ready for orders"} />
        <Stat label="Invested" value={formatMoney(portfolio.summary.holdingsValue)} note={`${portfolio.holdings.length} holdings`} />
        <Stat label="Class rank" value={currentRank ? `#${currentRank.rank}` : "—"} note={`of ${leaderboard.length} portfolios`} />
        <Stat label="Unrealized gain" value={formatMoney(portfolio.summary.unrealizedGain)} note="On current holdings" tone={portfolio.summary.unrealizedGain >= 0 ? "positive" : "negative"} />
      </section>

      <div className="portfolio-layout">
        <HoldingTable holdings={portfolio.holdings} />
        <aside className="side-stack">
          <div className="card" style={{ padding: "1.2rem" }}>
            <span className="eyebrow">Next best step</span>
            <div style={{ width: "2.8rem", height: "2.8rem", borderRadius: ".65rem", background: "var(--sky)", display: "grid", placeItems: "center", border: "1px solid var(--ink)", margin: "1rem 0" }}><BookOpen /></div>
            <h2 style={{ fontSize: "1.1rem", margin: "0 0 .45rem" }}>Don’t carry every egg in one basket</h2>
            <p className="muted" style={{ fontSize: ".82rem", lineHeight: 1.55 }}>Learn how diversification changes the range of possible outcomes.</p>
            <Link className="button-secondary" href="/app/learn" style={{ width: "100%", marginTop: ".7rem" }}>Continue learning</Link>
          </div>
          <div className="card" style={{ padding: "1.2rem" }}>
            <span className="eyebrow">Class leaders</span>
            <div className="compact-list" style={{ marginTop: ".7rem" }}>{leaderboard.slice(0, 5).map((row) => <div className="compact-row" key={row.studentId}><div style={{ display: "flex", gap: ".65rem", alignItems: "center" }}><span className="rank-number">{row.rank}</span><span><strong style={{ display: "block", fontSize: ".8rem" }}>{row.displayName}</strong><span className="muted" style={{ fontSize: ".68rem" }}>{formatPercent(row.returnPercent)}</span></span></div><strong style={{ fontSize: ".78rem" }}>{formatMoney(row.equity, { cents: false })}</strong></div>)}</div>
            <Link className="button-quiet" href="/app/season" style={{ width: "100%" }}>View the full season →</Link>
          </div>
          <div className="card" style={{ padding: "1.2rem", background: "#fff4d7" }}>
            <div style={{ display: "flex", gap: ".7rem" }}><Lightbulb size={20} /><div><strong style={{ fontSize: ".85rem" }}>Decision reminder</strong><p className="muted" style={{ fontSize: ".75rem", lineHeight: 1.5, margin: ".3rem 0 0" }}>A rising price does not prove a decision was good. Revisit the evidence in your journal.</p></div></div>
          </div>
        </aside>
      </div>

      <section className="card" style={{ marginTop: "1rem", padding: "1.2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", gap: ".9rem", alignItems: "center" }}><span style={{ width: "2.7rem", height: "2.7rem", display: "grid", placeItems: "center", background: "var(--coral)", border: "1px solid var(--ink)", borderRadius: ".7rem" }}><CalendarDays /></span><div><span className="eyebrow">Assignment · Due Aug 14</span><strong style={{ display: "block", marginTop: ".3rem" }}>Explain one portfolio decision</strong></div></div>
        <Link className="button-secondary" href="/app/journal"><WalletCards size={17} /> Open your journal</Link>
      </section>
    </>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "positive" | "negative" }) {
  return <div className="card stat-card"><span className="eyebrow">{label}</span><strong className={tone}>{value}</strong><span className="muted" style={{ fontSize: ".74rem" }}>{note}</span></div>;
}
