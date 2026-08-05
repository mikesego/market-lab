export type MarketSession = {
  state: "open" | "closed" | "pre" | "after";
  date: string;
  regularOpenMinutes: number;
  regularCloseMinutes: number;
  isHoliday: boolean;
  isEarlyClose: boolean;
};

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function observedDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  if (weekday === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1);
  return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function nthWeekday(year: number, month: number, weekday: number, occurrence: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + offset + (occurrence - 1) * 7;
  return dateKey(year, month, day);
}

function lastWeekday(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return dateKey(year, month, last.getUTCDate() - offset);
}

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function marketHolidayDates(year: number) {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setUTCDate(easter.getUTCDate() - 2);
  const holidays = new Set([
    observedDate(year, 1, 1),
    nthWeekday(year, 1, 1, 3),
    nthWeekday(year, 2, 1, 3),
    dateKey(goodFriday.getUTCFullYear(), goodFriday.getUTCMonth() + 1, goodFriday.getUTCDate()),
    lastWeekday(year, 5, 1),
    observedDate(year, 6, 19),
    observedDate(year, 7, 4),
    nthWeekday(year, 9, 1, 1),
    nthWeekday(year, 11, 4, 4),
    observedDate(year, 12, 25),
  ]);
  // A New Year's Day observed on Dec 31 belongs to the following holiday year.
  holidays.add(observedDate(year + 1, 1, 1));
  return holidays;
}

export function earlyCloseDates(year: number) {
  const thanksgiving = new Date(`${nthWeekday(year, 11, 4, 4)}T12:00:00Z`);
  const fridayAfter = new Date(thanksgiving);
  fridayAfter.setUTCDate(thanksgiving.getUTCDate() + 1);
  const values = new Set([dateKey(year, 11, fridayAfter.getUTCDate())]);
  const julyThird = new Date(Date.UTC(year, 6, 3));
  const holidays = marketHolidayDates(year);
  const julyThirdKey = dateKey(year, 7, 3);
  if (julyThird.getUTCDay() >= 1 && julyThird.getUTCDay() <= 5 && !holidays.has(julyThirdKey)) values.add(julyThirdKey);
  const christmasEve = new Date(Date.UTC(year, 11, 24));
  const christmasEveKey = dateKey(year, 12, 24);
  if (christmasEve.getUTCDay() >= 1 && christmasEve.getUTCDay() <= 5 && !holidays.has(christmasEveKey)) values.add(christmasEveKey);
  return values;
}

export function getUsEquitySession(at = new Date()): MarketSession {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  const year = Number(value("year"));
  const month = Number(value("month"));
  const day = Number(value("day"));
  const weekday = value("weekday");
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  const date = dateKey(year, month, day);
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const isHoliday = marketHolidayDates(year).has(date);
  const isEarlyClose = earlyCloseDates(year).has(date);
  const close = isEarlyClose ? 13 * 60 : 16 * 60;
  const total = hour * 60 + minute;
  let state: MarketSession["state"] = "closed";
  if (!isWeekend && !isHoliday) {
    if (total >= 4 * 60 && total < 9 * 60 + 30) state = "pre";
    else if (total >= 9 * 60 + 30 && total < close) state = "open";
    else if (total >= close && total < 20 * 60) state = "after";
  }
  return { state, date, regularOpenMinutes: 570, regularCloseMinutes: close, isHoliday, isEarlyClose };
}
