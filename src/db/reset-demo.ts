import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { Pool } from "pg";

import { cashLedger, fills, games, portfolios } from "./schema";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to reset demo data.");

const pool = new Pool({ connectionString, max: 1 });
const resetDb = drizzle(pool);

async function resetDemo() {
  const [game] = await resetDb.select({ id: games.id }).from(games).where(eq(games.joinCode, "OAK-724")).limit(1);
  if (!game) {
    console.log("Demo game was not present; nothing to remove.");
    return;
  }
  const portfolioRows = await resetDb.select({ id: portfolios.id }).from(portfolios).where(eq(portfolios.gameId, game.id));
  const portfolioIds = portfolioRows.map((row) => row.id);
  await resetDb.transaction(async (tx) => {
    if (portfolioIds.length) {
      await tx.delete(cashLedger).where(inArray(cashLedger.portfolioId, portfolioIds));
      await tx.delete(fills).where(inArray(fills.portfolioId, portfolioIds));
    }
    await tx.delete(games).where(eq(games.id, game.id));
  });
  console.log("Removed only the OAK-724 demonstration game and its dependent records.");
}

resetDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
