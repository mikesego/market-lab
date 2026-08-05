import type { Metadata } from "next";
import Link from "next/link";

import { InfoSections, PublicInfoPage } from "@/components/public-info-page";

export const metadata: Metadata = { title: "For educators" };

export default function EducatorsPage() {
  return <PublicInfoPage eyebrow="For educators" title="See the class, not just the standings." intro="Market Lab gives teachers a clear operational view and a richer learning view without asking them to become trading-platform administrators."><InfoSections sections={[
    { title: "Set the boundaries once", body: <p>Configure dates, allowed securities, fractional shares, position limits, reflection requirements, and what students can see on the leaderboard. Pause or resume trading for the whole season when class needs change.</p> },
    { title: "Watch for teachable moments", body: <p>The dashboard surfaces concentration, idle cash, unfilled orders, missing rationales, low-confidence decisions, and incomplete lessons. These are discussion starters—not hidden penalties.</p> },
    { title: "Assess learning separately", body: <p>Review lesson checks, journal entries, assignments, and evidence of diversification or research. Export financial results and learning evidence as separate, understandable reports.</p> },
    { title: "Protect student identity", body: <p>Students can participate with teacher-created aliases and PINs. Adult accounts handle class administration; student accounts do not require email, social login, or public profiles.</p> },
    { title: "Explore the working demo", body: <p><Link className="button-primary" href="/teacher/demo">Open the teacher console</Link></p> },
  ]} /></PublicInfoPage>;
}
