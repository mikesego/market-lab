"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, Gauge, Settings2, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  ["/teacher/demo", "Overview", Gauge],
  ["/teacher/demo/roster", "Roster", UsersRound],
  ["/teacher/demo/activity", "Activity", ClipboardList],
  ["/teacher/demo/assignments", "Assignments", ClipboardList],
  ["/teacher/demo/reports", "Reports", BarChart3],
  ["/teacher/demo/settings", "Season settings", Settings2],
] as const;

export function TeacherNav() {
  const pathname = usePathname();
  return <nav aria-label="Teacher workspace">{links.map(([href, label, Icon]) => { const active = href === "/teacher/demo" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("nav-link focus-ring", active && "nav-link-active")}><Icon size={18} />{label}</Link>; })}</nav>;
}
