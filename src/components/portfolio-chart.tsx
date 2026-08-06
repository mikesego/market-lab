"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PortfolioHistoryPoint } from "@/lib/portfolio/history";
import { formatMoney } from "@/lib/utils";

export function PortfolioChart({ points, variant = "light" }: { points: PortfolioHistoryPoint[]; variant?: "light" | "dark" }) {
  const values = points.map((point) => point.value);
  const currentValue = values.at(-1) ?? 0;
  const lowValue = Math.min(...values);
  const highValue = Math.max(...values);
  const spread = highValue - lowValue;
  const padding = spread > 0 ? Math.max(spread * 0.18, 10) : Math.max(Math.abs(currentValue) * 0.002, 25);
  const low = lowValue - padding;
  const high = highValue + padding;
  const isFlat = spread < 0.005;
  const firstDay = points[0] ? new Date(points[0].at).toDateString() : "";
  const lastDay = points.at(-1) ? new Date(points.at(-1)!.at).toDateString() : "";
  const sameDay = firstDay === lastDay;
  const formatTime = (value: string) => new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric" }).format(new Date(value));

  return <>
    <div style={{ height: 260, width: "100%" }} role="img" aria-label={`Recorded portfolio value history ending at ${formatMoney(currentValue)}`}>
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 20, right: 10, bottom: 4, left: 10 }}>
          <defs>
            <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8ebf35" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#8ebf35" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={variant === "dark" ? "rgba(255,255,255,.18)" : "var(--line)"} strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="at" tickFormatter={formatTime} minTickGap={40} tickLine={false} axisLine={false} tick={{ fill: variant === "dark" ? "#b9cbc5" : "#6d7d77", fontSize: 11 }} />
          <YAxis domain={[low, high]} hide />
          <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleString()} formatter={(value) => formatMoney(Number(value))} labelStyle={{ color: "#153d34" }} contentStyle={{ border: "1px solid #153d34", borderRadius: 10, background: "#fffdf5" }} />
          <Area type="monotone" dataKey="value" name="Portfolio value" stroke={variant === "dark" ? "#c7f36b" : "#285b50"} strokeWidth={3} fill="url(#portfolioFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <p className={`muted chart-note${variant === "dark" ? " chart-note-dark" : ""}`}>{isFlat
      ? `Your recorded portfolio value has stayed at ${formatMoney(currentValue)}.`
      : "This chart uses recorded portfolio values from your actual simulated cash and holdings."}</p>
  </>;
}
