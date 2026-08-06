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
  // pg currently treats sslmode=require as certificate-verifying but will
  // weaken that behavior in its next major release. Preserve today's strict
  // verification explicitly and keep the scheduled-job logs warning-free.
  const strictConnectionString = connectionString.replace(
    /([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/,
    "$1sslmode=verify-full",
  );

  const pool = new Pool({
    connectionString: strictConnectionString,
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
