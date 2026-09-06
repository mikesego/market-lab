import type { Metadata } from "next";
import { InfoSections, PublicInfoPage } from "@/components/public-info-page";

export const metadata: Metadata = { title: "Terms" };
export default function TermsPage() {
  return <PublicInfoPage eyebrow="Terms" title="Practice investing, not financial advice." intro="These development terms summarize the intended boundaries of Market Lab and must be replaced with reviewed production terms before real-student use."><InfoSections sections={[
    { title: "Educational simulation", body: <p>All cash, positions, orders, fills, gains, losses, and rankings are simulated. Nothing on the service is an offer, recommendation, brokerage service, or instruction to buy or sell a real security.</p> },
    { title: "Authorized classroom use", body: <p>Teachers and schools are responsible for inviting participants, choosing appropriate settings, supervising activity, and using exports consistently with their own policies and applicable law.</p> },
    { title: "Market data", body: <p>Market Lab uses Alpaca Basic’s IEX feed. Classroom trades execute at the latest downloaded price, which may be old while offline. Each investment shows its source time. IEX prices can differ from consolidated market prices.</p> },
    { title: "Fair use", body: <p>Users may not attempt to disrupt the service, access another person’s account, scrape restricted data, introduce malicious content, or represent simulated results as real brokerage records.</p> },
  ]} /></PublicInfoPage>;
}
