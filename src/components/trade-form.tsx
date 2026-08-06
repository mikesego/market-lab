"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";

import { submitTrade, type TradeState } from "@/app/actions/trading";
import { formatMoney } from "@/lib/utils";

export function TradeForm({
  symbol,
  price,
  marketState,
  availableCash,
  ownedQuantity,
  allowFractional,
  requireRationale,
}: {
  symbol: string;
  price: number;
  marketState: string;
  availableCash: number;
  ownedQuantity: number;
  allowFractional: boolean;
  requireRationale: boolean;
}) {
  const [state, action, pending] = useActionState(submitTrade, {} as TradeState);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("1");
  const [limit, setLimit] = useState(price.toFixed(2));
  const estimate = useMemo(() => Number(quantity || 0) * (orderType === "limit" ? Number(limit || 0) : price), [quantity, orderType, limit, price]);

  return <form action={action} className="trade-ticket card" style={{ display: "grid", gap: "1rem" }}>
    <input type="hidden" name="symbol" value={symbol} />
    {state.error ? <div className="error-box" role="alert">{state.error}</div> : null}
    <div><span className="eyebrow">Order ticket</span><h2 className="display" style={{ fontSize: "2.1rem", margin: ".35rem 0 0" }}>{symbol}</h2></div>
    <div className="segmented" aria-label="Order side">
      <label><input type="radio" name="side" value="buy" checked={side === "buy"} onChange={() => setSide("buy")} /><span>Buy</span></label>
      <label><input type="radio" name="side" value="sell" checked={side === "sell"} onChange={() => setSide("sell")} /><span>Sell</span></label>
    </div>
    <div className="field"><label htmlFor="orderType">Order type</label><select className="select" id="orderType" name="orderType" value={orderType} onChange={(event) => setOrderType(event.target.value as "market" | "limit")}><option value="market">Market order</option><option value="limit">Limit order</option></select></div>
    <div className="field"><label htmlFor="quantity">Shares</label><input className="input" id="quantity" name="quantity" type="number" inputMode={allowFractional ? "decimal" : "numeric"} min={allowFractional ? "0.000001" : "1"} step={allowFractional ? "0.000001" : "1"} value={quantity} onChange={(event) => setQuantity(event.target.value)} required />{!allowFractional ? <span className="field-hint">This investment trades in whole shares.</span> : null}</div>
    {orderType === "limit" ? <div className="field"><label htmlFor="limitPrice">Limit price</label><input className="input" id="limitPrice" name="limitPrice" type="number" inputMode="decimal" min="0.01" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} required /></div> : null}
    <div className="field"><label htmlFor="rationale">Why does this decision make sense?{requireRationale ? "" : " (optional)"}</label><textarea className="textarea" id="rationale" name="rationale" minLength={requireRationale ? 20 : undefined} maxLength={600} placeholder="I expect… because… One risk or fact that could change my mind is…" required={requireRationale} /></div>
    <div className="field"><label htmlFor="confidence">Confidence (1 = unsure, 5 = very confident)</label><input id="confidence" name="confidence" type="range" min="1" max="5" defaultValue="3" /></div>
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", display: "grid", gap: ".5rem", fontSize: ".82rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Estimated price</span><strong>{formatMoney(orderType === "limit" ? Number(limit) : price)}</strong></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Estimated total</span><strong>{formatMoney(estimate)}</strong></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">{side === "buy" ? "Available cash" : "Shares owned"}</span><strong>{side === "buy" ? formatMoney(availableCash) : ownedQuantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong></div>
    </div>
    {marketState !== "open" ? <div className="info-box"><AlertCircle size={16} style={{ display: "inline", marginRight: 6 }} />The regular session is {marketState}. This order will queue and be eligible at the next open.</div> : null}
    <button className="button-primary" type="submit" disabled={pending}>{pending ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRight size={18} />}{pending ? "Checking order…" : `Review and submit ${side}`}</button>
    <p className="muted" style={{ fontSize: ".7rem", lineHeight: 1.5, margin: 0 }}>Simulated order. No real security is purchased. Waiting orders are checked automatically during regular market hours and remain active until filled, canceled, or the season ends. A fill price can differ from the last displayed price.</p>
  </form>;
}
