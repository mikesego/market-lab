import { describe, expect, it } from "vitest";

import {
  applyBuyToPosition,
  applySellToPosition,
  totalReturnPercent,
  validateOrder,
} from "../../src/lib/trading/calculations";

describe("order validation", () => {
  it("accepts a fully funded market buy", () => {
    const result = validateOrder({ side: "buy", orderType: "market", quantity: "2.5", quote: "100", cashAvailable: "500", positionQuantity: 0, allowFractional: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.estimatedTotal.toFixed(2)).toBe("250.00");
  });

  it("rejects spending more cash than is available", () => {
    const result = validateOrder({ side: "buy", orderType: "market", quantity: "6", quote: "100", cashAvailable: "500", positionQuantity: 0, allowFractional: true });
    expect(result).toMatchObject({ ok: false, code: "INSUFFICIENT_CASH" });
  });

  it("rejects fractional shares when the game disables them", () => {
    const result = validateOrder({ side: "buy", orderType: "market", quantity: "1.5", quote: "100", cashAvailable: "500", positionQuantity: 0, allowFractional: false });
    expect(result).toMatchObject({ ok: false, code: "FRACTIONAL_DISABLED" });
  });

  it("does not permit selling more than the unreserved position", () => {
    const result = validateOrder({ side: "sell", orderType: "market", quantity: "4", quote: "100", cashAvailable: 0, positionQuantity: "3.75", allowFractional: true });
    expect(result).toMatchObject({ ok: false, code: "INSUFFICIENT_SHARES" });
  });

  it("requires a positive limit price", () => {
    const result = validateOrder({ side: "buy", orderType: "limit", quantity: "1", limitPrice: "0", quote: "100", cashAvailable: "500", positionQuantity: 0, allowFractional: true });
    expect(result).toMatchObject({ ok: false, code: "INVALID_LIMIT" });
  });
});

describe("position accounting", () => {
  it("uses a quantity-weighted average cost for buys", () => {
    const result = applyBuyToPosition({ currentQuantity: 10, currentAverageCost: 100, fillQuantity: 5, fillPrice: 130 });
    expect(result.quantity.toFixed()).toBe("15");
    expect(result.averageCost.toFixed(2)).toBe("110.00");
  });

  it("realizes gain without changing the remaining cost basis", () => {
    const result = applySellToPosition({ currentQuantity: 10, currentAverageCost: 100, fillQuantity: 4, fillPrice: 125 });
    expect(result.quantity.toFixed()).toBe("6");
    expect(result.averageCost.toFixed(2)).toBe("100.00");
    expect(result.realizedGain.toFixed(2)).toBe("100.00");
  });

  it("calculates financial return without any learning modifier", () => {
    expect(totalReturnPercent(104500, 100000).toFixed(2)).toBe("4.50");
    expect(totalReturnPercent(93000, 100000).toFixed(2)).toBe("-7.00");
  });
});
