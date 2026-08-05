import Link from "next/link";
import { ArrowLeft, BookMarked, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";

import { TradeForm } from "@/components/trade-form";
import { getInstrumentPositionDTO, getStudentPortfolioDTO } from "@/lib/data/student";
import { MARKET_CATALOG_BY_SYMBOL } from "@/lib/market/catalog";
import { getReplayQuote } from "@/lib/market/replay-provider";
import { formatMoney, formatPercent } from "@/lib/utils";

export default async function TradePage({ params }: PageProps<"/app/trade/[symbol]">) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();
  const catalogItem = MARKET_CATALOG_BY_SYMBOL.get(symbol);
  if (!catalogItem) notFound();
  const [position, portfolio] = await Promise.all([getInstrumentPositionDTO(symbol), getStudentPortfolioDTO()]);
  if (!position || !portfolio) return null;
  const quote = getReplayQuote(symbol);
  const owned = Number(position.position?.quantity ?? 0);
  return <>
    <Link className="button-quiet" href={`/app/stocks/${symbol}`} style={{ paddingLeft: 0 }}><ArrowLeft size={16} /> Back to {symbol} research</Link>
    <div className="page-title"><div><span className="eyebrow">Simulated order</span><h1>Trade {catalogItem.name}</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>{symbol} · {formatMoney(quote.price)} · <span className={quote.change >= 0 ? "positive" : "negative"}>{formatPercent(quote.changePercent)}</span></p></div></div>
    <div className="trade-grid">
      <section className="side-stack">
        <div className="card" style={{ padding: "1.4rem" }}><span className="eyebrow">Before you submit</span><h2 className="display" style={{ fontSize: "2.3rem", margin: ".6rem 0" }}>Name the idea—and what could prove it wrong.</h2><p className="muted" style={{ lineHeight: 1.7 }}>A thoughtful decision can have a bad short-term result. A weak decision can get lucky. Your rationale lets you learn which was which.</p></div>
        <div className="card" style={{ padding: "1.25rem" }}><div style={{ display: "flex", gap: ".8rem", alignItems: "start" }}><BookMarked size={21} /><div><strong>Market vs. limit</strong><p className="muted" style={{ fontSize: ".82rem", lineHeight: 1.6 }}>A market order prioritizes getting the trade done. A limit order prioritizes your chosen price and may never fill.</p></div></div></div>
        <div className="card" style={{ padding: "1.25rem", background: "#ffe9e1" }}><div style={{ display: "flex", gap: ".8rem", alignItems: "start" }}><ShieldAlert size={21} /><div><strong>Concentration guardrail</strong><p className="muted" style={{ fontSize: ".82rem", lineHeight: 1.6 }}>No single investment can exceed {Number(position.session.maxPositionPercent).toFixed(0)}% of portfolio value in this season.</p></div></div></div>
      </section>
      <TradeForm symbol={symbol} price={quote.price} marketState={quote.marketState} availableCash={portfolio.summary.availableCash} ownedQuantity={owned} />
    </div>
  </>;
}
