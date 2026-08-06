ALTER TABLE "orders" ALTER COLUMN "time_in_force" SET DEFAULT 'gtc';
--> statement-breakpoint
UPDATE "orders" AS "order"
SET
	"time_in_force" = 'gtc',
	"expires_at" = "game"."ends_at"
FROM "portfolios" AS "portfolio"
INNER JOIN "games" AS "game" ON "game"."id" = "portfolio"."game_id"
WHERE
	"order"."portfolio_id" = "portfolio"."id"
	AND "order"."status" IN ('queued', 'open', 'partially_filled');
