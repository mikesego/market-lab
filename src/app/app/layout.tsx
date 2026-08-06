import Link from "next/link";
import { Bell, Clock3, LogOut } from "lucide-react";
import { redirect } from "next/navigation";

import { signOutStudent } from "@/app/actions/student-auth";
import { Brand } from "@/components/brand";
import { DemoBanner } from "@/components/demo-banner";
import { StudentNav } from "@/components/student-nav";
import { getStudentSession } from "@/lib/auth/student-session";
import { getUsEquitySession } from "@/lib/market/calendar";

export default async function StudentLayout({ children }: LayoutProps<"/app">) {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  const marketState = getUsEquitySession().state;
  return (
    <div className="app-frame">
      <DemoBanner />
      <aside className="app-sidebar">
        <Brand />
        <StudentNav />
        <div className="sidebar-season card" style={{ marginTop: "1.4rem", padding: ".9rem" }}>
          <span className="eyebrow">Active season</span>
          <strong style={{ display: "block", margin: ".5rem 0 .2rem", fontSize: ".84rem" }}>{session.gameName}</strong>
          <span className="muted" style={{ fontSize: ".7rem" }}>Ends {session.endsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · Code {session.joinCode}</span>
        </div>
        <form action={signOutStudent} style={{ marginTop: ".9rem" }}>
          <button className="button-quiet" type="submit"><LogOut size={16} /> Sign out</button>
        </form>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
            <span className="status-pill" style={{ color: marketState === "open" ? "var(--positive)" : "var(--muted)" }}><Clock3 size={13} /> IEX market {marketState}</span>
            <span className="muted" style={{ fontSize: ".72rem" }}>Regular session 9:30–4:00 ET</span>
          </div>
          <div style={{ display: "flex", gap: ".8rem", alignItems: "center" }}>
            <Link href="/app/help" aria-label="Notifications" className="button-quiet focus-ring" style={{ paddingInline: ".6rem" }}><Bell size={18} /></Link>
            <Link href="/app/account" className="focus-ring" style={{ display: "flex", alignItems: "center", gap: ".6rem", fontWeight: 800, fontSize: ".82rem" }}>
              <span style={{ width: "2rem", height: "2rem", display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--sky)", border: "1px solid var(--ink)" }}>{session.displayName[0]}</span>
              {session.displayName}
            </Link>
          </div>
        </header>
        <main id="main-content" className="app-content">{children}</main>
      </div>
    </div>
  );
}
