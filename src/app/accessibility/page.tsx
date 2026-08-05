import type { Metadata } from "next";
import { InfoSections, PublicInfoPage } from "@/components/public-info-page";

export const metadata: Metadata = { title: "Accessibility" };
export default function AccessibilityPage() {
  return <PublicInfoPage eyebrow="Accessibility" title="The whole class should be able to participate." intro="Market Lab targets WCAG 2.2 AA and treats accessibility as a product requirement, not a final checklist."><InfoSections sections={[
    { title: "Interaction", body: <p>Core flows are designed for keyboard operation, visible focus, large touch targets, clear labels, understandable errors, and reduced-motion preferences.</p> },
    { title: "Visual information", body: <p>Gains and losses never rely on color alone. Charts include text summaries and tables. Typography, contrast, spacing, and responsive layouts support zoom and smaller screens.</p> },
    { title: "Learning content", body: <p>Lessons use short sections, explicit vocabulary, plain-language explanations, and meaningful headings without removing real financial terminology.</p> },
    { title: "Feedback", body: <p>If you encounter a barrier, email <a href="mailto:accessibility@stocks.mikesego.com" style={{ textDecoration: "underline" }}>accessibility@stocks.mikesego.com</a> with the page and task you were trying to complete.</p> },
  ]} /></PublicInfoPage>;
}
