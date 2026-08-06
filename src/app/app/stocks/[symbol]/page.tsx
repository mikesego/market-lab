import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CircleAlert, Layers3 } from "lucide-react";
import { notFound } from "next/navigation";

import { StockChart } from "@/components/stock-chart";
import { MARKET_CATALOG_BY_SYMBOL } from "@/lib/market/catalog";
import { marketDataProvider } from "@/lib/market/provider";
import { formatMoney, formatPercent } from "@/lib/utils";

export default async function StockDetailPage({ params }: PageProps<"/app/stocks/[symbol]">) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();
  const instrument = MARKET_CATALOG_BY_SYMBOL.get(symbol);
  if (!instrument) notFound();
  const [quote, points] = await Promise.all([
    marketDataProvider.getQuote(symbol),
    marketDataProvider.getSeries(symbol, 30),
  ]);
  return <>
    <Link className="button-quiet" href="/app/discover" style={{ paddingLeft: 0 }}><ArrowLeft size={16} /> Back to discover</Link>
    <div className="page-title" style={{ marginTop: ".6rem" }}><div style={{ display: "flex", gap: "1rem", alignItems: "center" }}><span className="symbol-logo" style={{ background: instrument.logoColor, width: "3.6rem", height: "3.6rem", fontSize: ".9rem" }}>{symbol.slice(0, 2)}</span><div><span className="eyebrow">{instrument.exchange} · {instrument.sector}</span><h1 style={{ marginTop: ".25rem" }}>{instrument.name} <span className="muted" style={{ fontFamily: "var(--font-manrope)", fontSize: "1rem" }}>{symbol}</span></h1></div></div><Link className="button-primary" href={`/app/trade/${symbol}`}>Trade {symbol} <ArrowRight size={17} /></Link></div>
    <div className="trade-grid">
      <section className="card" style={{ padding: "1.3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "end" }}><div><span className="eyebrow">Live IEX price</span><strong style={{ display: "block", fontSize: "2.6rem", letterSpacing: "-.05em", marginTop: ".35rem" }}>{formatMoney(quote.price)}</strong><span className={quote.change >= 0 ? "positive" : "negative"} style={{ fontWeight: 850 }}>{formatMoney(quote.change)} · {formatPercent(quote.changePercent)} today</span></div><span className="status-pill">Market {quote.marketState}</span></div>
        <StockChart points={points} />
        <div className="info-box"><CircleAlert size={16} style={{ display: "inline", marginRight: 6 }} />Real-time IEX data from Alpaca Basic. The chart uses adjusted daily bars. All orders and money in Market Lab remain simulated.</div>
      </section>
      <aside className="side-stack">
        <section className="card" style={{ padding: "1.3rem" }}><span className="eyebrow">The business</span><h2 style={{ fontSize: "1.15rem", margin: ".8rem 0 .5rem" }}>What does {instrument.name} do?</h2><p className="muted" style={{ lineHeight: 1.65, fontSize: ".85rem" }}>{instrument.description}</p><div className="compact-row"><span className="symbol-cell"><Building2 size={18} />Type</span><strong style={{ textTransform: "capitalize" }}>{instrument.assetType}</strong></div><div className="compact-row"><span className="symbol-cell"><Layers3 size={18} />Sector</span><strong>{instrument.sector}</strong></div></section>
        <section className="card" style={{ padding: "1.3rem" }}><span className="eyebrow">What may move it</span><div className="compact-list" style={{ marginTop: ".7rem" }}>{instrument.whyItMoves.map((reason, index) => <div className="compact-row" key={reason}><span className="rank-number">{index + 1}</span><span style={{ flex: 1, fontSize: ".84rem", fontWeight: 720 }}>{reason}</span></div>)}</div></section>
        <section className="card" style={{ padding: "1.3rem", background: "#fff4d7" }}><span className="eyebrow">Research prompt</span><p style={{ lineHeight: 1.65, fontSize: ".86rem", marginBottom: 0 }}>What could go right for this business? What could go wrong? Which fact would be most useful before deciding?</p></section>
      </aside>
    </div>
  </>;
}
