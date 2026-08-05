import type { Metadata } from "next";

import { InfoSections, PublicInfoPage } from "@/components/public-info-page";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorksPage() {
  return <PublicInfoPage eyebrow="Product guide" title="A market simulation built around decisions." intro="Market Lab combines faithful portfolio mechanics with short, timely learning moments. Students practice the whole process instead of chasing a price chart."><InfoSections sections={[
    { title: "1. A teacher opens a season", body: <p>The teacher chooses dates, starting cash, allowed investments, order rules, leaderboard visibility, and learning assignments. Each student gets a classroom-safe alias, username, and PIN.</p> },
    { title: "2. Every student starts equally", body: <p>Each portfolio begins with $100,000 of simulated cash. No one receives an advantage from learning points, badges, or teacher ratings. Financial rank is based only on portfolio equity.</p> },
    { title: "3. Orders behave like orders", body: <p>A market order requests the next available simulated price. A limit order waits until its condition can be met. Orders submitted outside the regular session queue for the next open. Cash is reserved so it cannot be spent twice.</p> },
    { title: "4. Research and reflection stay attached", body: <p>Before submitting an order, a student states a reason and confidence level. Later, the journal keeps the original reasoning beside the outcome, helping students distinguish a good decision from a lucky result.</p> },
    { title: "5. The leaderboard stays understandable", body: <p>At season end, the portfolio with the highest ending equity ranks first. Because every student starts with the same amount, ranking by equity, profit, or total return produces the same order. Learning mastery appears in a separate report.</p> },
  ]} /></PublicInfoPage>;
}
