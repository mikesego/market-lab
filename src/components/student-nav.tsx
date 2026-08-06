"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Binoculars,
  BookOpen,
  CircleHelp,
  ClipboardList,
  House,
  Landmark,
  NotebookPen,
  Settings,
  Trophy,
} from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  ["/app", "Today", House],
  ["/app/discover", "Discover", Binoculars],
  ["/app/portfolio", "Portfolio", Landmark],
  ["/app/orders", "Orders", ClipboardList],
  ["/app/learn", "Learn", BookOpen],
  ["/app/assignments", "Assignments", ClipboardList],
  ["/app/journal", "Journal", NotebookPen],
  ["/app/season", "Season", Trophy],
  ["/app/help", "Help", CircleHelp],
  ["/app/account", "Account", Settings],
] as const;

export function StudentNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Student workspace">
      {links.map(([href, label, Icon]) => {
        const active = href === "/app" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} className={cn("nav-link focus-ring", active && "nav-link-active")}><Icon size={18} aria-hidden="true" />{label}</Link>;
      })}
    </nav>
  );
}
