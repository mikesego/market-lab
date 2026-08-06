import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const adultUsers = pgTable(
  "adult_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email"),
    displayName: text("display_name"),
    role: text("role").default("teacher").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("adult_users_clerk_uidx").on(table.clerkUserId)],
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    timezone: text("timezone").default("America/New_York").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("organizations_slug_uidx").on(table.slug)],
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => adultUsers.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").default("teacher").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.userId] })],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    ownerId: uuid("owner_id").references(() => adultUsers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    joinCode: text("join_code").notNull(),
    status: text("status").default("draft").notNull(),
    dataMode: text("data_mode").default("alpaca_iex").notNull(),
    startingCash: numeric("starting_cash", { precision: 18, scale: 4 })
      .default("100000")
      .notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    tradeDelayMinutes: integer("trade_delay_minutes").default(0).notNull(),
    allowFractional: boolean("allow_fractional").default(true).notNull(),
    allowShorting: boolean("allow_shorting").default(false).notNull(),
    allowMargin: boolean("allow_margin").default(false).notNull(),
    maxPositionPercent: numeric("max_position_percent", { precision: 6, scale: 3 })
      .default("30")
      .notNull(),
    minCashPercent: numeric("min_cash_percent", { precision: 6, scale: 3 })
      .default("0")
      .notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("games_join_code_uidx").on(table.joinCode),
    index("games_owner_idx").on(table.ownerId),
  ],
);

export const classrooms = pgTable(
  "classrooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    gradeBand: text("grade_band").default("6-8").notNull(),
    ...timestamps,
  },
  (table) => [index("classrooms_game_idx").on(table.gameId)],
);

export const students = pgTable(
  "students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    classroomId: uuid("classroom_id").references(() => classrooms.id, {
      onDelete: "set null",
    }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    pinHash: text("pin_hash").notNull(),
    avatarKey: text("avatar_key").default("sprout").notNull(),
    status: text("status").default("active").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("students_game_username_uidx").on(table.gameId, table.username),
    index("students_classroom_idx").on(table.classroomId),
  ],
);

export const studentSessions = pgTable(
  "student_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("student_sessions_token_uidx").on(table.tokenHash),
    index("student_sessions_student_idx").on(table.studentId),
  ],
);

export const loginRateLimits = pgTable("login_rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  attempts: integer("attempts").default(0).notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    exchange: text("exchange").notNull(),
    assetType: text("asset_type").default("stock").notNull(),
    sector: text("sector"),
    description: text("description"),
    logoColor: text("logo_color").default("#16352f").notNull(),
    basePrice: numeric("base_price", { precision: 18, scale: 6 }).notNull(),
    volatility: numeric("volatility", { precision: 10, scale: 6 }).default("0.018").notNull(),
    isTradable: boolean("is_tradable").default(true).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("instruments_symbol_uidx").on(table.symbol)],
);

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    status: text("status").default("active").notNull(),
    cashBalance: numeric("cash_balance", { precision: 18, scale: 4 }).notNull(),
    reservedCash: numeric("reserved_cash", { precision: 18, scale: 4 }).default("0").notNull(),
    realizedGain: numeric("realized_gain", { precision: 18, scale: 4 }).default("0").notNull(),
    version: integer("version").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("portfolios_game_student_uidx").on(table.gameId, table.studentId),
    index("portfolios_game_idx").on(table.gameId),
  ],
);

export const portfolioEquitySnapshots = pgTable(
  "portfolio_equity_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .references(() => portfolios.id, { onDelete: "cascade" })
      .notNull(),
    equity: numeric("equity", { precision: 18, scale: 4 }).notNull(),
    cash: numeric("cash", { precision: 18, scale: 4 }).notNull(),
    holdingsValue: numeric("holdings_value", { precision: 18, scale: 4 }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("portfolio_equity_snapshots_portfolio_time_idx").on(table.portfolioId, table.capturedAt)],
);

export const positions = pgTable(
  "positions",
  {
    portfolioId: uuid("portfolio_id")
      .references(() => portfolios.id, { onDelete: "cascade" })
      .notNull(),
    instrumentId: uuid("instrument_id")
      .references(() => instruments.id, { onDelete: "restrict" })
      .notNull(),
    quantity: numeric("quantity", { precision: 22, scale: 8 }).default("0").notNull(),
    averageCost: numeric("average_cost", { precision: 18, scale: 6 }).default("0").notNull(),
    realizedGain: numeric("realized_gain", { precision: 18, scale: 4 }).default("0").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.portfolioId, table.instrumentId] }),
    index("positions_instrument_idx").on(table.instrumentId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .references(() => portfolios.id, { onDelete: "cascade" })
      .notNull(),
    instrumentId: uuid("instrument_id")
      .references(() => instruments.id, { onDelete: "restrict" })
      .notNull(),
    clientOrderId: text("client_order_id").notNull(),
    side: text("side").notNull(),
    orderType: text("order_type").notNull(),
    timeInForce: text("time_in_force").default("gtc").notNull(),
    quantity: numeric("quantity", { precision: 22, scale: 8 }).notNull(),
    limitPrice: numeric("limit_price", { precision: 18, scale: 6 }),
    status: text("status").default("pending").notNull(),
    filledQuantity: numeric("filled_quantity", { precision: 22, scale: 8 }).default("0").notNull(),
    reservedAmount: numeric("reserved_amount", { precision: 18, scale: 4 }).default("0").notNull(),
    submittedQuote: numeric("submitted_quote", { precision: 18, scale: 6 }).notNull(),
    rejectionCode: text("rejection_code"),
    rejectionMessage: text("rejection_message"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_client_order_uidx").on(table.portfolioId, table.clientOrderId),
    index("orders_portfolio_status_idx").on(table.portfolioId, table.status),
  ],
);

export const fills = pgTable(
  "fills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "restrict" })
      .notNull(),
    portfolioId: uuid("portfolio_id")
      .references(() => portfolios.id, { onDelete: "restrict" })
      .notNull(),
    instrumentId: uuid("instrument_id")
      .references(() => instruments.id, { onDelete: "restrict" })
      .notNull(),
    quantity: numeric("quantity", { precision: 22, scale: 8 }).notNull(),
    price: numeric("price", { precision: 18, scale: 6 }).notNull(),
    fees: numeric("fees", { precision: 18, scale: 4 }).default("0").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("fills_provider_event_uidx").on(table.providerEventId),
    index("fills_portfolio_idx").on(table.portfolioId),
  ],
);

export const cashLedger = pgTable(
  "cash_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .references(() => portfolios.id, { onDelete: "restrict" })
      .notNull(),
    eventType: text("event_type").notNull(),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
    runningBalance: numeric("running_balance", { precision: 18, scale: 4 }).notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    memo: text("memo").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("cash_ledger_portfolio_time_idx").on(table.portfolioId, table.occurredAt)],
);

export const corporateActions = pgTable(
  "corporate_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    instrumentId: uuid("instrument_id")
      .references(() => instruments.id, { onDelete: "restrict" })
      .notNull(),
    actionType: text("action_type").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    splitNumerator: integer("split_numerator"),
    splitDenominator: integer("split_denominator"),
    cashAmountPerShare: numeric("cash_amount_per_share", { precision: 18, scale: 6 }),
    status: text("status").default("pending").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("corporate_actions_provider_uidx").on(table.providerEventId),
    index("corporate_actions_effective_idx").on(table.effectiveAt, table.status),
  ],
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    instrumentId: uuid("instrument_id")
      .references(() => instruments.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.instrumentId] })],
);

export const lessons = pgTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    concept: text("concept").notNull(),
    minutes: integer("minutes").default(6).notNull(),
    position: integer("position").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("lessons_position_uidx").on(table.position)],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    lessonId: text("lesson_id")
      .references(() => lessons.id, { onDelete: "cascade" })
      .notNull(),
    status: text("status").default("not_started").notNull(),
    score: integer("score"),
    attempts: integer("attempts").default(0).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.lessonId] })],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    gameId: uuid("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    prompt: text("prompt").notNull(),
    thesis: text("thesis").notNull(),
    confidence: integer("confidence").default(3).notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    ...timestamps,
  },
  (table) => [index("journal_entries_student_idx").on(table.studentId, table.createdAt)],
);

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  category: text("category").notNull(),
});

export const studentAchievements = pgTable(
  "student_achievements",
  {
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    achievementId: text("achievement_id")
      .references(() => achievements.id, { onDelete: "cascade" })
      .notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true }).defaultNow().notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.achievementId] })],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    classroomId: uuid("classroom_id").references(() => classrooms.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull(),
    type: text("type").default("reflection").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [index("assignments_game_idx").on(table.gameId)],
);

export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    assignmentId: uuid("assignment_id")
      .references(() => assignments.id, { onDelete: "cascade" })
      .notNull(),
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "cascade" })
      .notNull(),
    status: text("status").default("submitted").notNull(),
    response: jsonb("response").$type<Record<string, unknown>>().default({}).notNull(),
    teacherFeedback: text("teacher_feedback"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.assignmentId, table.studentId] })],
);

export const rankingSnapshots = pgTable(
  "ranking_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    portfolioId: uuid("portfolio_id")
      .references(() => portfolios.id, { onDelete: "cascade" })
      .notNull(),
    equity: numeric("equity", { precision: 18, scale: 4 }).notNull(),
    totalReturnPercent: numeric("total_return_percent", { precision: 12, scale: 6 }).notNull(),
    rank: integer("rank").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    isFinal: boolean("is_final").default(false).notNull(),
  },
  (table) => [index("ranking_snapshots_game_time_idx").on(table.gameId, table.capturedAt)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    gameId: uuid("game_id").references(() => games.id, { onDelete: "set null" }),
    requestId: text("request_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_events_game_time_idx").on(table.gameId, table.occurredAt)],
);

export type Instrument = typeof instruments.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type Order = typeof orders.$inferSelect;
