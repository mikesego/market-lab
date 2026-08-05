import Link from "next/link";
import { ArrowLeft, FlaskConical, LockKeyhole } from "lucide-react";

import { Brand } from "@/components/brand";
import { DemoBanner } from "@/components/demo-banner";
import { TeacherNav } from "@/components/teacher-nav";

export default function TeacherDemoLayout({ children }: LayoutProps<"/teacher/demo">) {
  return <div className="app-frame"><DemoBanner /><aside className="app-sidebar"><Brand /><TeacherNav /><div className="sidebar-season card" style={{ marginTop: "1.4rem", padding: ".9rem", background: "#e4f5f7" }}><span className="eyebrow">Demo workspace</span><strong style={{ display: "block", margin: ".5rem 0 .3rem", fontSize: ".82rem" }}>Redwood Ridge School</strong><span className="muted" style={{ fontSize: ".7rem" }}>Changes are preview-only.</span></div><Link className="button-quiet" style={{ marginTop: ".8rem" }} href="/"><ArrowLeft size={16} /> Home page</Link></aside><div className="app-main"><header className="app-topbar"><div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}><span className="status-pill"><FlaskConical size={13} /> Teacher demo</span><strong style={{ fontSize: ".82rem" }}>Fall Market Lab</strong></div><Link href="/teacher" className="button-secondary" style={{ minHeight: "2.35rem" }}><LockKeyhole size={15} /> Sign in to manage</Link></header><main id="main-content" className="app-content">{children}</main></div></div>;
}
