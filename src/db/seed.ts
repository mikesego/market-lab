import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { Pool } from "pg";

import { MARKET_CATALOG } from "../lib/market/catalog";
import { hashPin } from "../lib/security/student-credentials";
import {
  achievements,
  assignments,
  cashLedger,
  classrooms,
  games,
  instruments,
  journalEntries,
  lessonProgress,
  lessons,
  organizations,
  orders,
  portfolios,
  positions,
  studentAchievements,
  students,
  watchlistItems,
} from "./schema";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed the database.");

const pool = new Pool({ connectionString, max: 1 });
const seedDb = drizzle(pool);

const lessonSeed = [
  {
    id: "market-basics",
    title: "What is a stock?",
    summary: "Meet shares, companies, owners, and the two ways investors can earn money.",
    concept: "Ownership",
    minutes: 6,
    position: 1,
    content: {
      hook: "Buying one share means owning one tiny piece of a real business.",
      vocabulary: ["share", "shareholder", "dividend"],
      check: "Why can the value of a share change?",
    },
  },
  {
    id: "orders-and-prices",
    title: "How an order becomes a trade",
    summary: "Follow a market order and a limit order from decision to fill.",
    concept: "Trading",
    minutes: 7,
    position: 2,
    content: {
      hook: "An order is a request. A fill is the moment a trade actually happens.",
      vocabulary: ["bid", "ask", "market order", "limit order"],
      check: "When might a limit order never fill?",
    },
  },
  {
    id: "risk-and-diversification",
    title: "Don’t carry every egg in one basket",
    summary: "See how diversification changes what can happen to a portfolio.",
    concept: "Risk",
    minutes: 8,
    position: 3,
    content: {
      hook: "Diversification cannot remove risk, but it can keep one surprise from deciding everything.",
      vocabulary: ["risk", "diversification", "sector", "ETF"],
      check: "How is owning an ETF different from owning one company?",
    },
  },
  {
    id: "reading-a-company",
    title: "Read the business, not the ticker",
    summary: "Connect revenue, profit, debt, and competition to the company behind a symbol.",
    concept: "Research",
    minutes: 9,
    position: 4,
    content: {
      hook: "A ticker is a shortcut; your real question is how the business works.",
      vocabulary: ["revenue", "profit", "debt", "competitor"],
      check: "Can revenue rise while profit falls?",
    },
  },
  {
    id: "news-with-evidence",
    title: "News, evidence, and noise",
    summary: "Separate a useful fact from a prediction, rumor, or exciting headline.",
    concept: "Media literacy",
    minutes: 8,
    position: 5,
    content: {
      hook: "A confident headline is not the same thing as strong evidence.",
      vocabulary: ["source", "evidence", "opinion", "uncertainty"],
      check: "What would make a source more trustworthy?",
    },
  },
];

const achievementSeed = [
  { id: "first-thesis", name: "Clear Thinker", description: "Write a reason before making a trade.", icon: "lightbulb", category: "learning" },
  { id: "first-trade", name: "First Fill", description: "Complete a first simulated trade.", icon: "sparkles", category: "milestone" },
  { id: "diversified", name: "Risk Builder", description: "Hold investments from at least three sectors.", icon: "shield", category: "learning" },
  { id: "lesson-three", name: "Concept Climber", description: "Complete three learning labs.", icon: "mountain", category: "learning" },
];

const studentSeed = [
  ["AveryFox", "Avery Fox", "fox"],
  ["SunnyKoala", "Sunny Koala", "koala"],
  ["BlueOtter", "Blue Otter", "otter"],
  ["SwiftPanda", "Swift Panda", "panda"],
  ["CoralHawk", "Coral Hawk", "hawk"],
  ["CleverMoth", "Clever Moth", "moth"],
  ["KindBadger", "Kind Badger", "badger"],
  ["BraveHeron", "Brave Heron", "heron"],
  ["GreenLynx", "Green Lynx", "lynx"],
  ["CalmGecko", "Calm Gecko", "gecko"],
  ["BrightWren", "Bright Wren", "wren"],
  ["RedTurtle", "Red Turtle", "turtle"],
] as const;

async function seed() {
  await seedDb.insert(instruments).values(
    MARKET_CATALOG.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      exchange: item.exchange,
      assetType: item.assetType,
      sector: item.sector,
      description: item.description,
      basePrice: item.basePrice.toString(),
      volatility: item.volatility.toString(),
      logoColor: item.logoColor,
      metadata: { whyItMoves: item.whyItMoves },
    })),
  ).onConflictDoNothing();

  await seedDb.insert(lessons).values(lessonSeed).onConflictDoNothing();
  await seedDb.insert(achievements).values(achievementSeed).onConflictDoNothing();

  const [organization] = await seedDb
    .insert(organizations)
    .values({ name: "Redwood Ridge School", slug: "redwood-ridge" })
    .onConflictDoUpdate({ target: organizations.slug, set: { name: "Redwood Ridge School" } })
    .returning();

  const [game] = await seedDb
    .insert(games)
    .values({
      organizationId: organization.id,
      name: "Fall Market Lab",
      joinCode: "OAK-724",
      status: "active",
      dataMode: "alpaca_iex",
      startsAt: new Date("2026-08-03T13:30:00.000Z"),
      endsAt: new Date("2026-10-30T20:00:00.000Z"),
      config: {
        benchmark: "SPY",
        rationaleRequired: true,
        leaderboardVisibility: "class_aliases",
      },
    })
    .onConflictDoUpdate({
      target: games.joinCode,
      set: { status: "active", updatedAt: new Date() },
    })
    .returning();

  let [classroom] = await seedDb
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.gameId, game.id), eq(classrooms.name, "Period 2 • Market Explorers")))
    .limit(1);
  if (!classroom) {
    [classroom] = await seedDb
      .insert(classrooms)
      .values({ gameId: game.id, name: "Period 2 • Market Explorers", gradeBand: "6-8" })
      .returning();
  }

  const instrumentRows = await seedDb.select().from(instruments);
  const instrumentBySymbol = new Map(instrumentRows.map((row) => [row.symbol, row]));
  const sharedPinHash = await hashPin("2468");

  for (const [index, [username, displayName, avatarKey]] of studentSeed.entries()) {
    const [student] = await seedDb
      .insert(students)
      .values({
        gameId: game.id,
        classroomId: classroom.id,
        username,
        displayName,
        avatarKey,
        pinHash: sharedPinHash,
      })
      .onConflictDoUpdate({
        target: [students.gameId, students.username],
        set: { displayName, avatarKey, status: "active", updatedAt: new Date() },
      })
      .returning();

    const [portfolio] = await seedDb
      .insert(portfolios)
      .values({ gameId: game.id, studentId: student.id, cashBalance: "100000" })
      .onConflictDoNothing()
      .returning();

    const existingPortfolio = portfolio ?? (
      await seedDb
        .select()
        .from(portfolios)
        .where(and(eq(portfolios.gameId, game.id), eq(portfolios.studentId, student.id)))
        .limit(1)
    )[0];

    const symbols = index === 0
      ? ["AAPL", "MSFT", "KO", "SPY"]
      : [MARKET_CATALOG[index % MARKET_CATALOG.length].symbol, MARKET_CATALOG[(index + 4) % MARKET_CATALOG.length].symbol];
    const quantities = index === 0 ? [30, 25, 100, 20] : [18 + index * 2, 8 + index];
    let invested = 0;

    for (const [positionIndex, symbol] of symbols.entries()) {
      const instrument = instrumentBySymbol.get(symbol);
      if (!instrument) continue;
      const averageCost = Number(instrument.basePrice) * (0.94 + ((index + positionIndex) % 5) * 0.018);
      const quantity = quantities[positionIndex];
      invested += averageCost * quantity;
      await seedDb
        .insert(positions)
        .values({
          portfolioId: existingPortfolio.id,
          instrumentId: instrument.id,
          quantity: quantity.toString(),
          averageCost: averageCost.toFixed(6),
        })
        .onConflictDoUpdate({
          target: [positions.portfolioId, positions.instrumentId],
          set: { quantity: quantity.toString(), averageCost: averageCost.toFixed(6), updatedAt: new Date() },
        });

      await seedDb
        .insert(watchlistItems)
        .values({ studentId: student.id, instrumentId: instrument.id })
        .onConflictDoNothing();

      if (index === 0) {
        const clientOrderId = `seed-${username.toLowerCase()}-${symbol}`;
        await seedDb
          .insert(orders)
          .values({
            portfolioId: existingPortfolio.id,
            instrumentId: instrument.id,
            clientOrderId,
            side: "buy",
            orderType: positionIndex === 1 ? "limit" : "market",
            quantity: quantity.toString(),
            limitPrice: positionIndex === 1 ? averageCost.toFixed(2) : null,
            status: "filled",
            filledQuantity: quantity.toString(),
            submittedQuote: averageCost.toFixed(6),
            submittedAt: new Date(Date.UTC(2026, 7, 3 + Math.min(positionIndex, 2), 14 + positionIndex, 18)),
          })
          .onConflictDoUpdate({
            target: [orders.portfolioId, orders.clientOrderId],
            set: { submittedAt: new Date(Date.UTC(2026, 7, 3 + Math.min(positionIndex, 2), 14 + positionIndex, 18)) },
          });
      }
    }

    const cash = Math.max(20_000, 100_000 - invested);
    await seedDb
      .update(portfolios)
      .set({ cashBalance: cash.toFixed(4), updatedAt: new Date() })
      .where(eq(portfolios.id, existingPortfolio.id));

    const existingLedger = await seedDb
      .select({ id: cashLedger.id })
      .from(cashLedger)
      .where(eq(cashLedger.portfolioId, existingPortfolio.id))
      .limit(1);
    if (!existingLedger.length) {
      await seedDb.insert(cashLedger).values([
        {
          portfolioId: existingPortfolio.id,
          eventType: "season_deposit",
          amount: "100000",
          runningBalance: "100000",
          memo: "Opening simulated cash",
          occurredAt: new Date("2026-08-03T13:30:00.000Z"),
        },
        {
          portfolioId: existingPortfolio.id,
          eventType: "trade_settlement",
          amount: (-invested).toFixed(4),
          runningBalance: cash.toFixed(4),
          memo: "Seeded simulated portfolio purchases",
          occurredAt: new Date("2026-08-04T15:00:00.000Z"),
        },
      ]);
    }

    if (index === 0) {
      await seedDb
        .insert(lessonProgress)
        .values([
          { studentId: student.id, lessonId: "market-basics", status: "completed", score: 100, attempts: 1, completedAt: new Date("2026-08-03T19:00:00.000Z") },
          { studentId: student.id, lessonId: "orders-and-prices", status: "completed", score: 80, attempts: 1, completedAt: new Date("2026-08-04T19:00:00.000Z") },
        ])
        .onConflictDoNothing();
      await seedDb
        .insert(studentAchievements)
        .values([
          { studentId: student.id, achievementId: "first-thesis", evidence: { source: "seed" } },
          { studentId: student.id, achievementId: "first-trade", evidence: { source: "seed" } },
        ])
        .onConflictDoNothing();
      const existingJournal = await seedDb
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(eq(journalEntries.studentId, student.id))
        .limit(1);
      if (!existingJournal.length) {
        await seedDb.insert(journalEntries).values({
          studentId: student.id,
          gameId: game.id,
          prompt: "What do you expect, and what evidence would change your mind?",
          thesis: "I chose a broad-market fund because one purchase spreads my money across many companies. I would rethink it if I needed the cash soon.",
          confidence: 4,
          tags: ["diversification", "long-term"],
        });
      }
    }
  }

  const existingAssignment = await seedDb
    .select({ id: assignments.id })
    .from(assignments)
    .where(and(eq(assignments.gameId, game.id), eq(assignments.title, "Explain one portfolio decision")))
    .limit(1);
  if (!existingAssignment.length) {
    await seedDb.insert(assignments).values({
      gameId: game.id,
      classroomId: classroom.id,
      title: "Explain one portfolio decision",
      instructions: "Choose one holding. Explain why it belongs in your portfolio and name one risk.",
      type: "reflection",
      dueAt: new Date("2026-08-14T23:59:00.000Z"),
    });
  }

  console.log("Seed complete: OAK-724 / AveryFox / PIN 2468");
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
