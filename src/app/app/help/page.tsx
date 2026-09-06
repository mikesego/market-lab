import { Clock3, Mail, ShieldAlert } from "lucide-react";

const faqs = [
  ["Why didn’t my order fill?", "The regular session may be closed, or a limit order may not have reached its price. Check the order status and submitted conditions."],
  ["What counts as my portfolio value?", "Cash plus the current live IEX value of every holding. Cash reserved for an open order still belongs to the portfolio; it simply cannot be spent twice."],
  ["Does completing a lesson improve my rank?", "No. The leaderboard is based only on portfolio equity. Lessons and recognitions appear in a separate learning record."],
  ["Can I lose real money?", "No. Every balance, order, fill, gain, and loss in Market Lab is simulated."],
  ["Are these live prices?", "Yes. Market Lab uses Alpaca Basic’s real-time IEX feed. IEX represents trading on one U.S. exchange, so prices can differ slightly from a consolidated whole-market quote."],
];

export default function HelpPage() {
  return <><div className="page-title"><div><span className="eyebrow">Help center</span><h1>Questions are part of the work</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Start here, then ask your teacher when a class rule or account detail needs attention.</p></div></div><div className="portfolio-layout"><section className="side-stack">{faqs.map(([question, answer]) => <details className="card" style={{ padding: "1.1rem 1.2rem" }} key={question}><summary style={{ cursor: "pointer", fontWeight: 850 }}>{question}</summary><p className="muted" style={{ lineHeight: 1.65, fontSize: ".86rem", marginBottom: 0 }}>{answer}</p></details>)}</section><aside className="side-stack"><HelpCard icon={<Clock3 />} title="Market hours" copy="Regular simulated trading follows 9:30 a.m.–4:00 p.m. Eastern on eligible market days." /><HelpCard icon={<ShieldAlert />} title="Safety or privacy" copy="Tell your teacher immediately if you see another student’s private information or something that feels unsafe." /><HelpCard icon={<Mail />} title="Technical issue" copy="Ask your teacher to report the page, time, and what you were trying to do." /></aside></div></>;
}
function HelpCard({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <div className="card" style={{ padding: "1.2rem" }}><span style={{ width: "2.6rem", height: "2.6rem", display: "grid", placeItems: "center", background: "var(--sky)", border: "1px solid var(--ink)", borderRadius: ".65rem" }}>{icon}</span><strong style={{ display: "block", margin: ".8rem 0 .3rem" }}>{title}</strong><p className="muted" style={{ lineHeight: 1.6, fontSize: ".8rem", margin: 0 }}>{copy}</p></div>; }
