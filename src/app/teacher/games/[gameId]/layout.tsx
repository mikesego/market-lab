import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, CalendarDays, School, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { Brand } from "@/components/brand";
import { DemoBanner } from "@/components/demo-banner";
import { TeacherNav } from "@/components/teacher-nav";
import { getTeacherWorkspace } from "@/lib/data/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherGameLayout({ children, params }: LayoutProps<"/teacher/games/[gameId]">) {
  const { gameId } = await params;
  const workspace = await getTeacherWorkspace(gameId);
  if (!workspace) notFound();
  const teacherName = workspace.clerkUser?.firstName ?? workspace.adult.displayName?.split(" ")[0] ?? "Teacher";
  const basePath = `/teacher/games/${gameId}`;
  return <div className="app-frame"><DemoBanner /><aside className="app-sidebar"><Brand /><TeacherNav basePath={basePath} /><div className="sidebar-season card teacher-season-card"><span className="eyebrow">Current workspace</span><strong><School size={14} /> {workspace.organization?.name ?? "Market Lab"}</strong><span>{workspace.classroom?.name ?? workspace.game.name}</span><span>Class code <b>{workspace.game.joinCode}</b></span></div><Link className="button-quiet" style={{ marginTop: ".8rem" }} href="/teacher/games"><ArrowLeft size={16} /> All seasons</Link></aside><div className="app-main"><header className="app-topbar"><div className="teacher-topbar-title"><span className="status-pill"><ShieldCheck size={13} /> {workspace.game.status}</span><strong>{workspace.game.name}</strong><span className="muted"><CalendarDays size={13} /> Ends {workspace.game.endsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div><div className="teacher-account"><span className="muted">Signed in as {teacherName}</span><UserButton /></div></header><main id="main-content" className="app-content">{children}</main></div></div>;
}
