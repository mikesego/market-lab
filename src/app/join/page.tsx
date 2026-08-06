import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, ShieldCheck, WalletCards } from "lucide-react";

import { Brand } from "@/components/brand";
import { JoinForm } from "@/components/join-form";

export const metadata: Metadata = { title: "Join your class" };

export default function JoinPage() {
  return (
    <main id="main-content" className="join-page">
      <section className="join-story dot-grid">
        <Brand inverse />
        <div>
          <span className="eyebrow" style={{ color: "var(--lime)" }}>Student entrance</span>
          <h1 className="display">Your next decision starts here.</h1>
          <p style={{ maxWidth: 610, color: "#cad7d3", lineHeight: 1.7, fontSize: "1.05rem" }}>
            Open your practice portfolio, check the market, research an idea, and write down why it makes sense before you trade.
          </p>
          <div style={{ display: "flex", gap: ".8rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
            <JoinBenefit icon={<WalletCards />} text="$100,000 practice cash" />
            <JoinBenefit icon={<BookOpen />} text="Built-in learning labs" />
            <JoinBenefit icon={<ShieldCheck />} text="No student email" />
          </div>
        </div>
        <Link href="/" style={{ display: "inline-flex", gap: ".5rem", alignItems: "center", color: "#cad7d3", fontWeight: 750, fontSize: ".85rem" }}><ArrowLeft size={16} /> Back to the home page</Link>
      </section>
      <section className="join-panel">
        <div className="join-card">
          <span className="eyebrow">Open your portfolio</span>
          <h2 className="display" style={{ fontSize: "3rem", margin: ".55rem 0 .6rem" }}>Join your class</h2>
          <p className="muted" style={{ lineHeight: 1.6, marginBottom: "1.5rem" }}>Use the three details on your teacher’s login card.</p>
          <div className="info-box" style={{ marginBottom: "1rem" }}>
            Demo credentials are already filled in. Prices come from Alpaca’s live IEX market feed; all money and trades are simulated.
          </div>
          <JoinForm />
        </div>
      </section>
    </main>
  );
}

function JoinBenefit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: ".45rem", border: "1px solid #648178", borderRadius: ".6rem", padding: ".55rem .7rem", fontSize: ".78rem", fontWeight: 750 }}>{icon}{text}</span>;
}
