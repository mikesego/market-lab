"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/utils";

export function StockChart({ points }: { points: { at: string; price: number }[] }) {
  const values = points.map((point) => point.price);
  const low = Math.min(...values) * .97;
  const high = Math.max(...values) * 1.03;
  return <div style={{ width: "100%", height: 320 }} role="img" aria-label={`Thirty-day adjusted price history from ${formatMoney(values[0])} to ${formatMoney(values.at(-1) ?? 0)}`}><ResponsiveContainer><AreaChart data={points} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="#e0e2d8" vertical={false} /><XAxis dataKey="at" tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })} minTickGap={30} tick={{ fontSize: 11, fill: "#68766f" }} /><YAxis domain={[low, high]} tickFormatter={(value) => `$${Math.round(value)}`} width={55} tick={{ fontSize: 11, fill: "#68766f" }} /><Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleDateString()} formatter={(value) => formatMoney(Number(value))} contentStyle={{ border: "1px solid #153d34", borderRadius: 10, background: "#fffdf5" }} /><Area type="monotone" dataKey="price" stroke="#285b50" strokeWidth={3} fill="#b8e6ef" fillOpacity={.5} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>;
}
