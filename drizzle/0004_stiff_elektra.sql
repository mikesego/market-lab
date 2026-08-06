CREATE TABLE "portfolio_equity_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"equity" numeric(18, 4) NOT NULL,
	"cash" numeric(18, 4) NOT NULL,
	"holdings_value" numeric(18, 4) NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_equity_snapshots" ADD CONSTRAINT "portfolio_equity_snapshots_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_equity_snapshots_portfolio_time_idx" ON "portfolio_equity_snapshots" USING btree ("portfolio_id","captured_at");