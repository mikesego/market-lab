import { CalendarRange, Medal, Trophy } from "lucide-react";

import { getLeaderboardDTO, getStudentPortfolioDTO } from "@/lib/data/student";
import { formatMoney, formatPercent } from "@/lib/utils";

export default async function SeasonPage() {
  const portfolio = await getStudentPortfolioDTO();
  if (!portfolio) return null;
  const leaderboard = await getLeaderboardDTO(portfolio.session.gameId);
  return <>
    <div className="page-title"><div><span className="eyebrow">Fall Market Lab</span><h1>Season standings</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Rank is based only on current portfolio equity. Everyone began with $100,000.</p></div><span className="status-pill"><CalendarRange size={14} /> Aug 3–Oct 30</span></div>
    <div className="info-box" style={{ marginBottom: "1rem" }}><Trophy size={17} style={{ display: "inline", marginRight: 7 }} /><strong>One transparent rule:</strong> the portfolio with the highest ending value wins. Lessons, badges, journal quality, and diversification never modify rank.</div>
    <div className="card table-card"><div className="table-header"><div><span className="eyebrow">Period 2</span><h2 style={{ margin: ".35rem 0 0" }}>Financial leaderboard</h2></div><span className="muted" style={{ fontSize: ".75rem" }}>Replay values update with the market clock</span></div><table className="data-table"><thead><tr><th>Rank</th><th>Portfolio</th><th>Value</th><th>Total return</th><th>Difference from start</th></tr></thead><tbody>{leaderboard.map((row) => { const mine = row.studentId === portfolio.session.studentId; return <tr key={row.studentId} style={{ background: mine ? "#edfad3" : undefined }}><td><span className="rank-number" style={{ background: row.rank <= 3 ? "var(--sun)" : undefined }}>{row.rank <= 3 ? <Medal size={14} /> : row.rank}</span></td><td><strong>{row.displayName}{mine ? " (you)" : ""}</strong></td><td><strong>{formatMoney(row.equity)}</strong></td><td className={row.returnPercent >= 0 ? "positive" : "negative"}>{formatPercent(row.returnPercent)}</td><td>{formatMoney(row.equity - 100000)}</td></tr>; })}</tbody></table></div>
    <section className="card" style={{ padding: "1.3rem", marginTop: "1rem" }}><span className="eyebrow">Learning recognitions</span><h2 className="display" style={{ fontSize: "2rem", margin: ".5rem 0" }}>More ways to notice strong work</h2><p className="muted" style={{ lineHeight: 1.65, maxWidth: 760 }}>At season end, your teacher can also recognize research, reflection, persistence, and risk thinking. Those recognitions tell a richer learning story, but they remain separate from the financial standings above.</p></section>
  </>;
}
