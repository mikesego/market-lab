import { describe, expect, it } from "vitest";

import { getUsEquitySession, marketHolidayDates } from "../../src/lib/market/calendar";

describe("U.S. equity market calendar", () => {
  it("opens during a normal weekday session", () => {
    expect(getUsEquitySession(new Date("2026-08-05T15:00:00.000Z")).state).toBe("open");
  });

  it("closes on weekends", () => {
    expect(getUsEquitySession(new Date("2026-08-08T15:00:00.000Z")).state).toBe("closed");
  });

  it("includes exchange holidays and Good Friday", () => {
    const holidays = marketHolidayDates(2026);
    expect(holidays.has("2026-04-03")).toBe(true);
    expect(holidays.has("2026-11-26")).toBe(true);
    expect(getUsEquitySession(new Date("2026-11-26T16:00:00.000Z")).state).toBe("closed");
  });

  it("uses a 1 p.m. Eastern close after Thanksgiving", () => {
    const noon = getUsEquitySession(new Date("2026-11-27T17:00:00.000Z"));
    const two = getUsEquitySession(new Date("2026-11-27T19:00:00.000Z"));
    expect(noon.isEarlyClose).toBe(true);
    expect(noon.state).toBe("open");
    expect(two.state).toBe("after");
  });

  it("does not label an observed Independence Day closure as an early close", () => {
    const session = getUsEquitySession(new Date("2026-07-03T16:00:00.000Z"));
    expect(session.isHoliday).toBe(true);
    expect(session.isEarlyClose).toBe(false);
    expect(session.state).toBe("closed");
  });
});
