"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/utils";

export function PortfolioChart({ currentValue }: { currentValue: number }) {
  const data = Array.from({ length: 18 }, (_, index) => {
    const progress = index / 17;
    const delta = Math.sin(index * .9) * 420 + progress * (currentValue - 100000);
    return { day: `Day ${index + 1}`, value: Math.round((100000 + delta) * 100) / 100 };
  });
  data[data.length - 1].value = currentValue;
  const low = Math.min(...data.map((point) => point.value)) - 600;
  const high = Math.max(...data.map((point) => point.value)) + 600;
  return (
    <div style={{ height: 260, width: "100%" }} role="img" aria-label={`Portfolio value trend ending at ${formatMoney(currentValue)}`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8ebf35" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#8ebf35" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" hide />
          <YAxis domain={[low, high]} hide />
          <Tooltip formatter={(value) => formatMoney(Number(value))} labelStyle={{ color: "#153d34" }} contentStyle={{ border: "1px solid #153d34", borderRadius: 10, background: "#fffdf5" }} />
          <Area type="monotone" dataKey="value" stroke="#285b50" strokeWidth={3} fill="url(#portfolioFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
