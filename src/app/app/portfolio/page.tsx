import Link from "next/link";
import { ArrowRight, Banknote, PieChart, Scale } from "lucide-react";

import { HoldingTable } from "@/components/holding-table";
import { PortfolioChart } from "@/components/portfolio-chart";
import { getStudentPortfolioDTO } from "@/lib/data/student";
import { formatMoney, formatPercent } from "@/lib/utils";

export default async function PortfolioPage() {
  const portfolio = await getStudentPortfolioDTO();
  if (!portfolio) return null;
  const allocation = portfolio.holdings.map((holding) => ({ name: holding.symbol, percent: portfolio.summary.equity ? holding.marketValue / portfolio.summary.equity * 100 : 0, color: holding.logoColor }));
  return <>
    <div className="page-title"><div><span className="eyebrow">Portfolio</span><h1>What you own</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Portfolio equity equals available and reserved cash plus the current value of every holding.</p></div><Link className="button-primary" href="/app/discover">Research an investment <ArrowRight size={17} /></Link></div>
    <section className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: "1rem" }}><Summary icon={<PieChart />} label="Portfolio value" value={formatMoney(portfolio.summary.equity)} /><Summary icon={<Banknote />} label="Cash" value={formatMoney(portfolio.summary.cash)} /><Summary icon={<Scale />} label="Total return" value={formatPercent(portfolio.summary.totalReturnPercent)} tone={portfolio.summary.totalReturnPercent >= 0 ? "positive" : "negative"} /><Summary icon={<PieChart />} label="Investments" value={`${portfolio.holdings.length}`} /></section>
    <div className="portfolio-layout"><div className="side-stack"><div className="card" style={{ padding: "1.2rem" }}><div className="table-header" style={{ padding: 0, border: 0 }}><div><span className="eyebrow">Equity history</span><h2 style={{ margin: ".35rem 0 0" }}>Portfolio value</h2></div></div><PortfolioChart points={portfolio.history} /></div><HoldingTable holdings={portfolio.holdings} /></div><aside className="side-stack"><div className="card" style={{ padding: "1.2rem" }}><span className="eyebrow">Allocation</span><div style={{ height: "1rem", display: "flex", overflow: "hidden", borderRadius: 999, margin: "1rem 0", background: "var(--paper-3)" }}>{allocation.map((item) => <span key={item.name} style={{ width: `${item.percent}%`, background: item.color }} />)}<span style={{ flex: 1, background: "#dfe2d7" }} /></div><div className="compact-list">{allocation.map((item) => <div className="compact-row" key={item.name}><span style={{ display: "flex", alignItems: "center", gap: ".5rem" }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />{item.name}</span><strong>{item.percent.toFixed(1)}%</strong></div>)}<div className="compact-row"><span>Cash</span><strong>{(portfolio.summary.cash / portfolio.summary.equity * 100).toFixed(1)}%</strong></div></div></div><div className="card" style={{ padding: "1.2rem", background: "#e4f5f7" }}><span className="eyebrow">Risk lens</span><h3 style={{ margin: ".7rem 0 .4rem" }}>Concentration is not the same as conviction.</h3><p className="muted" style={{ lineHeight: 1.6, fontSize: ".8rem" }}>A large position makes one company more able to change your whole result. Check whether the risk is intentional.</p></div></aside></div>
  </>;
}
function Summary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) { return <div className="card stat-card"><span style={{ color: "var(--ink-2)" }}>{icon}</span><span className="eyebrow" style={{ display: "block", marginTop: ".65rem" }}>{label}</span><strong className={tone}>{value}</strong></div>; }
