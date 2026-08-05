import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  Brain,
  Check,
  ClipboardList,
  GraduationCap,
  LineChart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { DemoBanner } from "@/components/demo-banner";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getReplayQuotes } from "@/lib/market/replay-provider";
import { formatMoney, formatPercent } from "@/lib/utils";

const barHeights = [34, 43, 38, 61, 54, 70, 64, 89, 78, 101, 94, 124, 117, 139, 132, 148];

export default function Home() {
  const quotes = getReplayQuotes().slice(0, 7);
  return (
    <>
      <DemoBanner />
      <SiteHeader />
      <main id="main-content">
        <section className="hero dot-grid">
          <div className="container-shell hero-grid">
            <div>
              <span className="eyebrow">The market is a classroom</span>
              <h1 className="display">Learn investing by doing.</h1>
              <p className="hero-copy">
                Students research real businesses, manage a $100,000 practice portfolio, and explain their choices. Teachers see the thinking behind every trade—not just who finished first.
              </p>
              <div className="hero-actions">
                <Link className="button-primary focus-ring" href="/join">Join with a class code</Link>
                <Link className="button-secondary focus-ring" href="/teacher/demo">Explore the teacher demo</Link>
              </div>
              <p className="muted" style={{ fontSize: ".78rem", marginTop: "1.2rem" }}>
                No real money. No ads. Student accounts need no email address.
              </p>
            </div>
            <div className="hero-board" aria-label="Illustration of the Market Lab portfolio dashboard">
              <div className="board-main">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <span className="eyebrow" style={{ color: "#b8e6ef" }}>Portfolio value</span>
                    <div style={{ fontSize: "2.55rem", fontWeight: 850, letterSpacing: "-.05em", marginTop: ".5rem" }}>$103,842.17</div>
                  </div>
                  <span className="status-pill" style={{ color: "#c7f36b", height: "fit-content" }}>Replay open</span>
                </div>
                <div className="board-chart" aria-hidden="true">
                  {barHeights.map((height, index) => <span key={index} style={{ height }} />)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: ".75rem" }}>
                  <BoardMetric label="Cash" value="$64,900" />
                  <BoardMetric label="Invested" value="$38,942" />
                  <BoardMetric label="Return" value="+3.84%" />
                </div>
              </div>
              <div className="board-float one"><Sparkles size={17} style={{ display: "inline", marginRight: 7 }} />Decision saved</div>
              <div className="board-float two"><Brain size={17} style={{ display: "inline", marginRight: 7 }} />What evidence could change your mind?</div>
            </div>
          </div>
        </section>

        <div className="ticker" aria-label="Sample replay prices">
          <div className="container-shell ticker-inner">
            <span className="eyebrow">Replay tape</span>
            {quotes.map((quote) => (
              <span className="ticker-item" key={quote.symbol}>
                {quote.symbol} {formatMoney(quote.price)}
                <span className={quote.change >= 0 ? "positive" : "negative"}>{formatPercent(quote.changePercent)}</span>
              </span>
            ))}
          </div>
        </div>

        <section className="section" id="how">
          <div className="container-shell">
            <div className="section-heading">
              <span className="eyebrow">Built for serious curiosity</span>
              <h2 className="display">A real simulation with a learning layer.</h2>
              <p>Students get the vocabulary, guardrails, and context to make independent decisions. The interface is approachable without pretending the market is simple.</p>
            </div>
            <div className="feature-grid">
              <Feature icon={<LineChart />} title="Authentic order flow" copy="Market and limit orders, open and closed sessions, queued orders, fills, cash reservations, and an auditable ledger." />
              <Feature icon={<Brain />} title="Thinking before trading" copy="A short investment thesis and confidence check turn every order into a decision students can revisit." />
              <Feature icon={<BookOpenCheck />} title="Learning in context" copy="Six-to-nine minute labs explain ownership, diversification, business performance, risk, and evidence." />
              <Feature icon={<BarChart3 />} title="A clean leaderboard" copy="Financial rank is simply ending portfolio value. Learning progress and decision quality are reported separately." />
              <Feature icon={<GraduationCap />} title="Teacher command center" copy="Create a season, distribute login cards, watch participation, pause trading, assign work, and export reports." />
              <Feature icon={<ShieldCheck />} title="Student privacy by design" copy="Pseudonymous classroom accounts, minimal data collection, no advertising, and clear adult controls." />
            </div>
          </div>
        </section>

        <section className="section market-stripe" style={{ backgroundColor: "#e4f3ef" }}>
          <div className="container-shell">
            <div className="section-heading">
              <span className="eyebrow">One clear loop</span>
              <h2 className="display">Research. Decide. Trade. Reflect.</h2>
            </div>
            <div className="steps">
              <Step number="01" title="Research" copy="Understand the company, fund, risks, and reasons a price might move." />
              <Step number="02" title="Decide" copy="Choose a side, quantity, order type, and the evidence behind the idea." />
              <Step number="03" title="Trade" copy="See whether the order fills, waits for the market, or misses a limit price." />
              <Step number="04" title="Reflect" copy="Compare what happened with the original thesis—not just the profit or loss." />
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="learning-outcomes-heading">
          <div className="container-shell learning-outcomes-grid">
            <div className="section-heading learning-outcomes-copy">
              <span className="eyebrow">For the whole class</span>
              <h2 className="display" id="learning-outcomes-heading">Winning is clear. Learning is richer.</h2>
              <p>The season champion is the portfolio with the highest ending value. That stays simple and transparent. Separately, teachers can recognize research, reflection, diversification, persistence, and concept mastery—without secretly changing the standings.</p>
              <div className="hero-actions">
                <Link className="button-primary" href="/educators">See the educator experience</Link>
                <Link className="button-quiet" href="/how-it-works">Read how scoring works →</Link>
              </div>
            </div>
            <div className="card-strong recognition-card">
              <span className="eyebrow">What teachers can recognize</span>
              {["Best-researched decision", "Strongest reflection", "Smart risk management", "Most-improved reasoning", "Season portfolio leader"].map((item) => (
                <div key={item} style={{ display: "flex", gap: ".7rem", alignItems: "center", padding: ".9rem 0", borderBottom: "1px solid var(--line)", fontWeight: 750 }}>
                  <Check size={18} /> {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: "var(--lime)", borderTop: "1px solid var(--ink)", padding: "4.5rem 0" }}>
          <div className="container-shell" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "2rem" }}>
            <div>
              <span className="eyebrow">Ready to look around?</span>
              <h2 className="display" style={{ fontSize: "clamp(2.7rem,6vw,5.4rem)", margin: ".5rem 0 0", lineHeight: .95 }}>Open the classroom.</h2>
            </div>
            <div style={{ display: "flex", gap: ".8rem", flexWrap: "wrap" }}>
              <Link className="button-secondary" href="/join"><ClipboardList size={18} /> Student demo</Link>
              <Link className="button-coral" href="/teacher/demo"><GraduationCap size={18} /> Teacher demo</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function BoardMetric({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: ".7rem", background: "rgba(255,255,255,.07)", borderRadius: ".6rem" }}><span style={{ display: "block", color: "#aec0ba", fontSize: ".66rem", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span><strong>{value}</strong></div>;
}

function Feature({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <article className="card feature-card"><div><div className="feature-icon">{icon}</div><h3>{title}</h3><p className="muted" style={{ lineHeight: 1.62 }}>{copy}</p></div><span aria-hidden="true" style={{ fontSize: "1.3rem" }}>↗</span></article>;
}

function Step({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <article className="step"><span className="step-number">{number}</span><h3>{title}</h3><p className="muted" style={{ lineHeight: 1.6 }}>{copy}</p></article>;
}
