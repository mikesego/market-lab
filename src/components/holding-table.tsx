import Link from "next/link";

import { formatMoney, formatPercent } from "@/lib/utils";

type Holding = {
  symbol: string;
  name: string;
  logoColor: string;
  quantity: string;
  averageCost: string;
  marketValue: number;
  gain: number;
  gainPercent: number;
  quote: { price: number };
};

export function HoldingTable({ holdings }: { holdings: Holding[] }) {
  return (
    <div className="card table-card">
      <div className="table-header"><div><span className="eyebrow">Your investments</span><h2 style={{ margin: ".35rem 0 0", fontSize: "1.2rem" }}>Holdings</h2></div><Link className="button-quiet" href="/app/discover">Find an investment →</Link></div>
      {holdings.length ? <div style={{ overflowX: "auto" }}><table className="data-table">
        <thead><tr><th>Investment</th><th>Price</th><th>Shares</th><th>Avg. cost</th><th>Value</th><th>Gain / loss</th></tr></thead>
        <tbody>{holdings.map((holding) => <tr key={holding.symbol}>
          <td><Link href={`/app/stocks/${holding.symbol}`} className="symbol-cell"><span className="symbol-logo" style={{ background: holding.logoColor }}>{holding.symbol.slice(0, 2)}</span><span><strong style={{ display: "block" }}>{holding.symbol}</strong><span className="muted" style={{ fontSize: ".72rem" }}>{holding.name}</span></span></Link></td>
          <td>{formatMoney(holding.quote.price)}</td>
          <td>{Number(holding.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
          <td>{formatMoney(holding.averageCost)}</td>
          <td><strong>{formatMoney(holding.marketValue)}</strong></td>
          <td className={holding.gain >= 0 ? "positive" : "negative"}><strong>{formatMoney(holding.gain)}</strong><br /><span style={{ fontSize: ".7rem" }}>{formatPercent(holding.gainPercent)}</span></td>
        </tr>)}</tbody>
      </table></div> : <div style={{ padding: "2rem", textAlign: "center" }}><p>You have not bought an investment yet.</p><Link className="button-primary" href="/app/discover">Explore the market</Link></div>}
    </div>
  );
}
