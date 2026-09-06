CREATE TABLE "classroom_devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"portfolio_version" integer NOT NULL,
	"last_sync_at" timestamp with time zone,
	"refresh_requested_at" timestamp with time zone,
	"prices_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_price_packs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"device_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classroom_devices" ADD CONSTRAINT "classroom_devices_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_price_packs" ADD CONSTRAINT "classroom_price_packs_device_id_classroom_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."classroom_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "classroom_devices_token_uidx" ON "classroom_devices" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "classroom_devices_portfolio_idx" ON "classroom_devices" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "classroom_price_packs_device_idx" ON "classroom_price_packs" USING btree ("device_id");