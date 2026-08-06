import "server-only";

import Decimal from "decimal.js";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  achievements,
  instruments,
  journalEntries,
  lessonProgress,
  lessons,
  orders,
  portfolioEquitySnapshots,
  portfolios,
  positions,
  studentAchievements,
  students,
  watchlistItems,
} from "@/db/schema";
import { getStudentSession } from "@/lib/auth/student-session";
import { marketDataProvider } from "@/lib/market/provider";
import { buildPortfolioHistory } from "@/lib/portfolio/history";
import { totalReturnPercent } from "@/lib/trading/calculations";

export async function getStudentPortfolioDTO() {
  const session = await getStudentSession();
  if (!session) return null;

  const [positionRows, orderRows, journalRows, watchlistRows] = await Promise.all([
    db
      .select({
        instrumentId: instruments.id,
        symbol: instruments.symbol,
        name: instruments.name,
        sector: instruments.sector,
        logoColor: instruments.logoColor,
        quantity: positions.quantity,
        averageCost: positions.averageCost,
      })
      .from(positions)
      .innerJoin(instruments, eq(positions.instrumentId, instruments.id))
      .where(and(eq(positions.portfolioId, session.portfolioId), gt(positions.quantity, "0")))
      .orderBy(asc(instruments.symbol)),
    db
      .select({
        id: orders.id,
        symbol: instruments.symbol,
        name: instruments.name,
        side: orders.side,
        orderType: orders.orderType,
        quantity: orders.quantity,
        limitPrice: orders.limitPrice,
        status: orders.status,
        submittedQuote: orders.submittedQuote,
        submittedAt: orders.submittedAt,
      })
      .from(orders)
      .innerJoin(instruments, eq(orders.instrumentId, instruments.id))
      .where(eq(orders.portfolioId, session.portfolioId))
      .orderBy(desc(orders.submittedAt))
      .limit(12),
    db
      .select({
        id: journalEntries.id,
        thesis: journalEntries.thesis,
        confidence: journalEntries.confidence,
        tags: journalEntries.tags,
        createdAt: journalEntries.createdAt,
      })
      .from(journalEntries)
      .where(eq(journalEntries.studentId, session.studentId))
      .orderBy(desc(journalEntries.createdAt))
      .limit(4),
    db
      .select({ symbol: instruments.symbol })
      .from(watchlistItems)
      .innerJoin(instruments, eq(watchlistItems.instrumentId, instruments.id))
      .where(eq(watchlistItems.studentId, session.studentId)),
  ]);

  const positionQuotes = await marketDataProvider.getQuotes(positionRows.map((position) => position.symbol));
  const quotesBySymbol = new Map(positionQuotes.map((quote) => [quote.symbol, quote]));
  let holdingsValue = new Decimal(0);
  let totalCost = new Decimal(0);
  const holdings = positionRows.map((position) => {
    const quote = quotesBySymbol.get(position.symbol);
    if (!quote) throw new Error(`A live quote is unavailable for ${position.symbol}.`);
    const quantity = new Decimal(position.quantity);
    const marketValue = quantity.times(quote.price);
    const cost = quantity.times(position.averageCost);
    const gain = marketValue.minus(cost);
    holdingsValue = holdingsValue.plus(marketValue);
    totalCost = totalCost.plus(cost);
    return {
      ...position,
      quote,
      marketValue: marketValue.toDecimalPlaces(2).toNumber(),
      gain: gain.toDecimalPlaces(2).toNumber(),
      gainPercent: cost.isZero() ? 0 : gain.div(cost).times(100).toDecimalPlaces(2).toNumber(),
    };
  });
  const equity = new Decimal(session.cashBalance).plus(holdingsValue);
  const start = new Decimal(session.startingCash);
  const now = new Date();
  const [latestSnapshot] = await db
    .select({ id: portfolioEquitySnapshots.id, capturedAt: portfolioEquitySnapshots.capturedAt })
    .from(portfolioEquitySnapshots)
    .where(eq(portfolioEquitySnapshots.portfolioId, session.portfolioId))
    .orderBy(desc(portfolioEquitySnapshots.capturedAt))
    .limit(1);
  const snapshotValues = {
    equity: equity.toFixed(4),
    cash: new Decimal(session.cashBalance).toFixed(4),
    holdingsValue: holdingsValue.toFixed(4),
  };
  if (!latestSnapshot || now.getTime() - latestSnapshot.capturedAt.getTime() >= 5 * 60_000) {
    await db.insert(portfolioEquitySnapshots).values({
      portfolioId: session.portfolioId,
      ...snapshotValues,
      capturedAt: now,
    });
  } else {
    await db
      .update(portfolioEquitySnapshots)
      .set(snapshotValues)
      .where(eq(portfolioEquitySnapshots.id, latestSnapshot.id));
  }
  const snapshots = await db
    .select({
      capturedAt: portfolioEquitySnapshots.capturedAt,
      equity: portfolioEquitySnapshots.equity,
    })
    .from(portfolioEquitySnapshots)
    .where(eq(portfolioEquitySnapshots.portfolioId, session.portfolioId))
    .orderBy(desc(portfolioEquitySnapshots.capturedAt))
    .limit(240);
  const history = buildPortfolioHistory({
    createdAt: session.portfolioCreatedAt,
    startingCash: start.toNumber(),
    snapshots,
    currentAt: now,
    currentValue: equity.toDecimalPlaces(2).toNumber(),
  });

  return {
    session,
    summary: {
      equity: equity.toDecimalPlaces(2).toNumber(),
      cash: Number(session.cashBalance),
      availableCash: new Decimal(session.cashBalance).minus(session.reservedCash).toNumber(),
      reservedCash: Number(session.reservedCash),
      holdingsValue: holdingsValue.toDecimalPlaces(2).toNumber(),
      totalGain: equity.minus(start).toDecimalPlaces(2).toNumber(),
      totalReturnPercent: totalReturnPercent(equity, start).toNumber(),
      unrealizedGain: holdingsValue.minus(totalCost).toDecimalPlaces(2).toNumber(),
    },
    holdings,
    orders: orderRows,
    journals: journalRows,
    watchlist: watchlistRows.map((row) => row.symbol),
    history,
  };
}

export async function getLearningDTO() {
  const session = await getStudentSession();
  if (!session) return null;

  const [lessonRows, progressRows, awardRows] = await Promise.all([
    db.select().from(lessons).orderBy(asc(lessons.position)),
    db.select().from(lessonProgress).where(eq(lessonProgress.studentId, session.studentId)),
    db
      .select({
        id: achievements.id,
        name: achievements.name,
        description: achievements.description,
        icon: achievements.icon,
        category: achievements.category,
        earnedAt: studentAchievements.earnedAt,
      })
      .from(studentAchievements)
      .innerJoin(achievements, eq(studentAchievements.achievementId, achievements.id))
      .where(eq(studentAchievements.studentId, session.studentId)),
  ]);
  const progressByLesson = new Map(progressRows.map((row) => [row.lessonId, row]));
  return {
    session,
    lessons: lessonRows.map((lesson) => ({ ...lesson, progress: progressByLesson.get(lesson.id) ?? null })),
    achievements: awardRows,
    completedCount: progressRows.filter((row) => row.status === "completed").length,
  };
}

export async function getLeaderboardDTO(gameId: string) {
  const [portfolioRows, positionRows] = await Promise.all([
    db
      .select({
        portfolioId: portfolios.id,
        studentId: students.id,
        displayName: students.displayName,
        avatarKey: students.avatarKey,
        cashBalance: portfolios.cashBalance,
      })
      .from(portfolios)
      .innerJoin(students, eq(portfolios.studentId, students.id))
      .where(and(eq(portfolios.gameId, gameId), eq(students.status, "active"))),
    db
      .select({ portfolioId: positions.portfolioId, symbol: instruments.symbol, quantity: positions.quantity })
      .from(positions)
      .innerJoin(instruments, eq(positions.instrumentId, instruments.id))
      .innerJoin(portfolios, eq(positions.portfolioId, portfolios.id))
      .where(and(eq(portfolios.gameId, gameId), gt(positions.quantity, "0"))),
  ]);

  const relevantPortfolioIds = new Set(portfolioRows.map((row) => row.portfolioId));
  const liveQuotes = await marketDataProvider.getQuotes(positionRows.map((row) => row.symbol));
  const quotesBySymbol = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));
  const values = new Map<string, Decimal>();
  for (const row of positionRows) {
    if (!relevantPortfolioIds.has(row.portfolioId)) continue;
    const quote = quotesBySymbol.get(row.symbol);
    if (!quote) throw new Error(`A live quote is unavailable for ${row.symbol}.`);
    const value = new Decimal(row.quantity).times(quote.price);
    values.set(row.portfolioId, (values.get(row.portfolioId) ?? new Decimal(0)).plus(value));
  }

  return portfolioRows
    .map((row) => {
      const equity = new Decimal(row.cashBalance).plus(values.get(row.portfolioId) ?? 0);
      return {
        portfolioId: row.portfolioId,
        studentId: row.studentId,
        displayName: row.displayName,
        avatarKey: row.avatarKey,
        equity: equity.toDecimalPlaces(2).toNumber(),
        returnPercent: totalReturnPercent(equity, 100000).toNumber(),
      };
    })
    .sort((a, b) => b.equity - a.equity)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getInstrumentPositionDTO(symbol: string) {
  const session = await getStudentSession();
  if (!session) return null;
  const upperSymbol = symbol.toUpperCase();
  const [instrument] = await db.select().from(instruments).where(eq(instruments.symbol, upperSymbol)).limit(1);
  if (!instrument) return null;
  const [position] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.portfolioId, session.portfolioId), eq(positions.instrumentId, instrument.id)))
    .limit(1);
  return { session, instrument, position: position ?? null };
}

export async function getWatchlistQuotes() {
  const session = await getStudentSession();
  if (!session) return null;
  const rows = await db
    .select({ symbol: instruments.symbol })
    .from(watchlistItems)
    .innerJoin(instruments, eq(watchlistItems.instrumentId, instruments.id))
    .where(eq(watchlistItems.studentId, session.studentId));
  const symbols = rows.length ? rows.map((row) => row.symbol) : ["AAPL", "MSFT", "SPY"];
  return marketDataProvider.getQuotes(symbols);
}

export async function getSymbolsByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(instruments).where(inArray(instruments.id, ids));
}
