import { describe, expect, it } from "vitest";

import { toCsv } from "../../src/lib/csv";
import { getEnabledLessonIds } from "../../src/lib/learning/config";

describe("teacher workspace utilities", () => {
  it("makes every lesson available when a season has no explicit lesson configuration", () => {
    expect([...getEnabledLessonIds({}, ["market-basics", "risk"])]).toEqual(["market-basics", "risk"]);
  });

  it("honors an explicit lesson selection and ignores invalid configuration values", () => {
    expect([...getEnabledLessonIds({ enabledLessonIds: ["risk", 12, null] }, ["market-basics", "risk"])]).toEqual(["risk"]);
  });

  it("escapes teacher CSV exports without losing commas, quotes, or line breaks", () => {
    expect(toCsv([
      ["Student", "Response"],
      ["River, Maya", "I compared \"risk\"\nwith return."],
    ])).toBe('Student,Response\r\n"River, Maya","I compared ""risk""\nwith return."');
  });
});
