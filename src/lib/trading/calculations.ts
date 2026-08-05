import Decimal from "decimal.js";

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";

export type OrderValidationInput = {
  side: OrderSide;
  orderType: OrderType;
  quantity: Decimal.Value;
  limitPrice?: Decimal.Value | null;
  quote: Decimal.Value;
  cashAvailable: Decimal.Value;
  positionQuantity: Decimal.Value;
  allowFractional: boolean;
};

export type OrderValidationResult =
  | { ok: true; estimatedPrice: Decimal; estimatedTotal: Decimal }
  | { ok: false; code: string; message: string };

export function validateOrder(input: OrderValidationInput): OrderValidationResult {
  let quantity: Decimal;
  let quote: Decimal;
  try {
    quantity = new Decimal(input.quantity);
    quote = new Decimal(input.quote);
  } catch {
    return { ok: false, code: "INVALID_NUMBER", message: "Enter a valid quantity." };
  }

  if (!quantity.isFinite() || quantity.lte(0)) {
    return { ok: false, code: "INVALID_QUANTITY", message: "Quantity must be greater than zero." };
  }
  if (!input.allowFractional && !quantity.isInteger()) {
    return { ok: false, code: "FRACTIONAL_DISABLED", message: "This game uses whole shares only." };
  }
  if (quantity.decimalPlaces() > 6) {
    return { ok: false, code: "TOO_PRECISE", message: "Use no more than six decimal places." };
  }

  let estimatedPrice = quote;
  if (input.orderType === "limit") {
    try {
      estimatedPrice = new Decimal(input.limitPrice ?? 0);
    } catch {
      return { ok: false, code: "INVALID_LIMIT", message: "Enter a valid limit price." };
    }
    if (estimatedPrice.lte(0)) {
      return { ok: false, code: "INVALID_LIMIT", message: "Limit price must be greater than zero." };
    }
  }

  const estimatedTotal = quantity.times(estimatedPrice).toDecimalPlaces(4, Decimal.ROUND_UP);
  if (input.side === "buy" && estimatedTotal.gt(new Decimal(input.cashAvailable))) {
    return {
      ok: false,
      code: "INSUFFICIENT_CASH",
      message: "This order is larger than your available cash.",
    };
  }
  if (input.side === "sell" && quantity.gt(new Decimal(input.positionQuantity))) {
    return {
      ok: false,
      code: "INSUFFICIENT_SHARES",
      message: "You cannot sell more shares than you own.",
    };
  }

  return { ok: true, estimatedPrice, estimatedTotal };
}

export function applyBuyToPosition(input: {
  currentQuantity: Decimal.Value;
  currentAverageCost: Decimal.Value;
  fillQuantity: Decimal.Value;
  fillPrice: Decimal.Value;
}) {
  const currentQuantity = new Decimal(input.currentQuantity);
  const fillQuantity = new Decimal(input.fillQuantity);
  const newQuantity = currentQuantity.plus(fillQuantity);
  const currentCost = currentQuantity.times(input.currentAverageCost);
  const fillCost = fillQuantity.times(input.fillPrice);
  return {
    quantity: newQuantity.toDecimalPlaces(8),
    averageCost: currentCost.plus(fillCost).div(newQuantity).toDecimalPlaces(6),
  };
}

export function applySellToPosition(input: {
  currentQuantity: Decimal.Value;
  currentAverageCost: Decimal.Value;
  fillQuantity: Decimal.Value;
  fillPrice: Decimal.Value;
}) {
  const currentQuantity = new Decimal(input.currentQuantity);
  const fillQuantity = new Decimal(input.fillQuantity);
  const averageCost = new Decimal(input.currentAverageCost);
  const newQuantity = currentQuantity.minus(fillQuantity);
  return {
    quantity: newQuantity.toDecimalPlaces(8),
    averageCost: newQuantity.isZero() ? new Decimal(0) : averageCost,
    realizedGain: new Decimal(input.fillPrice).minus(averageCost).times(fillQuantity).toDecimalPlaces(4),
  };
}

export function totalReturnPercent(equity: Decimal.Value, startingEquity: Decimal.Value) {
  const start = new Decimal(startingEquity);
  if (start.isZero()) return new Decimal(0);
  return new Decimal(equity).minus(start).div(start).times(100).toDecimalPlaces(2);
}
