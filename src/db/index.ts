import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

declare global {
  var __marketLabPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  const pool = new Pool({
    connectionString,
    max: 8,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  attachDatabasePool(pool);
  return pool;
}

export const pool = globalThis.__marketLabPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__marketLabPool = pool;
}

export const db = drizzle(pool, { schema });

export type Database = typeof db;
