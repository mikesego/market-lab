import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";

import { MARKET_CATALOG } from "@/lib/market/catalog";
import { getReplayQuote } from "@/lib/market/replay-provider";
import { formatMoney, formatPercent } from "@/lib/utils";

export default function DiscoverPage() {
  const instruments = MARKET_CATALOG.map((instrument) => ({ instrument, quote: getReplayQuote(instrument.symbol) }));
  return <>
    <div className="page-title"><div><span className="eyebrow">Research desk</span><h1>Discover investments</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Start with the business and the risk—not today’s color.</p></div></div>
    <div className="card" style={{ display: "flex", gap: ".7rem", alignItems: "center", padding: ".75rem 1rem", marginBottom: "1rem" }}><Search size={20} aria-hidden="true" /><input aria-label="Search investments" placeholder="Search by company, symbol, or sector" style={{ border: 0, outline: 0, background: "transparent", flex: 1, minWidth: 0 }} /><button className="button-quiet" type="button"><SlidersHorizontal size={17} /> Filters</button></div>
    <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>{["All", "Stocks", "ETFs", "Technology", "Consumer", "Broad market"].map((filter, index) => <button key={filter} type="button" className={index === 0 ? "button-primary" : "button-quiet"} style={{ minHeight: "2.2rem" }}>{filter}</button>)}</div>
    <div className="discover-grid">{instruments.map(({ instrument, quote }) => <Link key={instrument.symbol} href={`/app/stocks/${instrument.symbol}`} className="card stock-card focus-ring"><div className="stock-card-top"><div className="symbol-cell"><span className="symbol-logo" style={{ background: instrument.logoColor }}>{instrument.symbol.slice(0, 2)}</span><div><strong>{instrument.symbol}</strong><span className="muted" style={{ display: "block", fontSize: ".7rem" }}>{instrument.exchange} · {instrument.assetType.toUpperCase()}</span></div></div><span className={quote.change >= 0 ? "positive" : "negative"} style={{ fontWeight: 850, fontSize: ".78rem" }}>{formatPercent(quote.changePercent)}</span></div><h2 style={{ fontSize: "1rem", margin: "1rem 0 .35rem" }}>{instrument.name}</h2><p className="muted" style={{ fontSize: ".78rem", lineHeight: 1.5, minHeight: "3.5em" }}>{instrument.description}</p><div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", borderTop: "1px solid var(--line)", paddingTop: ".8rem", marginTop: ".9rem" }}><div><span className="eyebrow">Replay price</span><strong style={{ display: "block", marginTop: ".3rem", fontSize: "1.25rem" }}>{formatMoney(quote.price)}</strong></div><span className="status-pill">{instrument.sector}</span></div></Link>)}</div>
  </>;
}
