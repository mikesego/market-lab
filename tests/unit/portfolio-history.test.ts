import { describe, expect, it } from "vitest";

import { buildPortfolioHistory } from "../../src/lib/portfolio/history";

describe("buildPortfolioHistory", () => {
  it("keeps a new all-cash portfolio flat at its true starting value", () => {
    const history = buildPortfolioHistory({
      createdAt: new Date("2026-08-06T16:00:00.000Z"),
      startingCash: 100_000,
      snapshots: [
        { capturedAt: new Date("2026-08-06T16:05:00.000Z"), equity: "100000.0000" },
        { capturedAt: new Date("2026-08-06T16:10:00.000Z"), equity: "100000.0000" },
      ],
      currentAt: new Date("2026-08-06T16:12:00.000Z"),
      currentValue: 100_000,
    });

    expect(history).toHaveLength(4);
    expect(history.every((point) => point.value === 100_000)).toBe(true);
  });

  it("preserves actual recorded changes in chronological order", () => {
    const history = buildPortfolioHistory({
      createdAt: new Date("2026-08-01T16:00:00.000Z"),
      startingCash: 100_000,
      snapshots: [
        { capturedAt: new Date("2026-08-03T16:00:00.000Z"), equity: "100350.25" },
        { capturedAt: new Date("2026-08-02T16:00:00.000Z"), equity: "99850.50" },
      ],
      currentAt: new Date("2026-08-04T16:00:00.000Z"),
      currentValue: 100_410,
    });

    expect(history.map((point) => point.value)).toEqual([100_000, 99_850.5, 100_350.25, 100_410]);
  });
});
