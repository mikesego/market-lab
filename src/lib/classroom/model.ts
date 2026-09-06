import Decimal from "decimal.js";
import { applyBuyToPosition, applySellToPosition, validateOrder } from "../trading/calculations";

export type ClassroomPosition = { quantity: string; averageCost: string; realizedGain: string };
export type ClassroomAccount = { cash: string; realizedGain: string; positions: Record<string, ClassroomPosition> };
export type ClassroomAsset = {
  instrumentId: string; symbol: string; name: string; description: string;
  sector: string; assetType: string; fractionable: boolean;
  price: string; asOf: string; providerEventId: string;
};
export type ClassroomRules = {
  status: string; startsAt: string; endsAt: string; allowFractional: boolean;
  maxPositionPercent: string; minCashPercent: string; rationaleRequired: boolean;
};
export type PricePack = {
  id: string; deviceId: string; fetchedAt: string;
  rules: ClassroomRules; assets: Record<string, ClassroomAsset>;
};
export type ClassroomTrade = {
  id: string; sequence: number; packId: string; symbol: string; side: "buy" | "sell";
  quantity: string; rationale: string; confidence: number; executedAt: string;
};
export type TradeReceipt = ClassroomTrade & { price: string; asOf: string; amount: string };
export type ClassroomState = {
  reconciling?: boolean;
  releasing?: boolean;
  schema: 1; deviceId: string; token: string; label: string;
  studentId: string; studentName: string; gameName: string; joinCode: string;
  startingCash: string; account: ClassroomAccount; pack: PricePack;
  // Keep only packs needed by unacknowledged trades; receipts retain price/as-of.
  packs: Record<string, PricePack>; trades: TradeReceipt[];
  lastSequence: number; acknowledgedSequence: number;
  lastSyncAt: string | null; syncError: string | null; pricesError: string | null;
  lessons: { id: string; title: string; summary: string; content: Record<string, unknown> }[];
};

export function accountEquity(account: ClassroomAccount, pack: PricePack) {
  return Object.entries(account.positions).reduce((total, [symbol, position]) => {
    if (new Decimal(position.quantity).isZero()) return total;
    const asset = pack.assets[symbol];
    if (!asset) throw new Error(`Download a price for ${symbol} before trading.`);
    return total.plus(new Decimal(position.quantity).times(asset.price));
  }, new Decimal(account.cash));
}

// Used in the browser AND by the server when replaying receipts. All money is
// decimal strings, with exactly the same rounding on both sides.
export function applyClassroomTrade(account: ClassroomAccount, pack: PricePack, trade: ClassroomTrade) {
  if (trade.packId !== pack.id) throw new Error("The saved price record does not match this trade.");
  const asset = pack.assets[trade.symbol];
  if (!asset || !new Decimal(asset.price).isFinite() || new Decimal(asset.price).lte(0)) throw new Error("Download a valid price for this investment first.");
  const when = Date.parse(trade.executedAt);
  if (!Number.isFinite(when) || when < Date.parse(pack.fetchedAt) - 300_000) throw new Error("Check this tablet’s date and time, then refresh prices.");
  if (pack.rules.status !== "active") throw new Error("Trading is paused. Reconnect after your teacher resumes the season.");
  if (when < Date.parse(pack.rules.startsAt)) throw new Error("This season has not started yet.");
  if (when >= Date.parse(pack.rules.endsAt)) throw new Error("This season has ended.");
  if (trade.rationale.length > 600 || (pack.rules.rationaleRequired && trade.rationale.trim().length < 20)) throw new Error("Write at least one complete reason (20–600 characters).");
  const position = account.positions[trade.symbol] ?? { quantity: "0", averageCost: "0", realizedGain: "0" };
  const validation = validateOrder({ side: trade.side, orderType: "market", quantity: trade.quantity, quote: asset.price, cashAvailable: account.cash, positionQuantity: position.quantity, allowFractional: pack.rules.allowFractional && asset.fractionable });
  if (!validation.ok) throw new Error(validation.message);
  const amount = new Decimal(trade.quantity).times(asset.price).toDecimalPlaces(4);
  if (amount.lt("0.0001")) throw new Error("Choose enough shares for a trade worth at least $0.0001.");
  const nextCash = new Decimal(account.cash)[trade.side === "buy" ? "minus" : "plus"](amount);
  if (trade.side === "buy") {
    const equity = accountEquity(account, pack);
    const value = new Decimal(position.quantity).plus(trade.quantity).times(asset.price);
    if (equity.lte(0) || value.div(equity).times(100).gt(pack.rules.maxPositionPercent)) throw new Error(`Keep each investment within ${Number(pack.rules.maxPositionPercent)}% of your portfolio.`);
    if (nextCash.div(equity).times(100).lt(pack.rules.minCashPercent)) throw new Error(`Keep at least ${Number(pack.rules.minCashPercent)}% of your portfolio in cash.`);
  }
  const changed = trade.side === "buy"
    ? applyBuyToPosition({ currentQuantity: position.quantity, currentAverageCost: position.averageCost, fillQuantity: trade.quantity, fillPrice: asset.price })
    : applySellToPosition({ currentQuantity: position.quantity, currentAverageCost: position.averageCost, fillQuantity: trade.quantity, fillPrice: asset.price });
  const gain = trade.side === "sell" ? new Decimal(asset.price).minus(position.averageCost).times(trade.quantity).toDecimalPlaces(4) : new Decimal(0);
  const next: ClassroomAccount = {
    cash: nextCash.toFixed(4), realizedGain: new Decimal(account.realizedGain).plus(gain).toFixed(4),
    positions: { ...account.positions, [trade.symbol]: { quantity: changed.quantity.toFixed(8), averageCost: changed.averageCost.toFixed(6), realizedGain: new Decimal(position.realizedGain).plus(gain).toFixed(4) } },
  };
  const receipt: TradeReceipt = { ...trade, price: asset.price, asOf: asset.asOf, amount: amount.toFixed(4) };
  return { account: next, receipt };
}
