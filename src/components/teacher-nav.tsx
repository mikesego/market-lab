"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, Gauge, Settings2, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  ["", "Overview", Gauge],
  ["/roster", "Roster", UsersRound],
  ["/activity", "Activity", ClipboardList],
  ["/assignments", "Assignments", ClipboardList],
  ["/reports", "Reports", BarChart3],
  ["/settings", "Season settings", Settings2],
] as const;

export function TeacherNav({ basePath = "/teacher/demo" }: { basePath?: string }) {
  const pathname = usePathname();
  return <nav aria-label="Teacher workspace">{links.map(([suffix, label, Icon]) => { const href = `${basePath}${suffix}`; const active = suffix === "" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("nav-link focus-ring", active && "nav-link-active")}><Icon size={18} />{label}</Link>; })}</nav>;
}
