CREATE TABLE "corporate_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"split_numerator" integer,
	"split_denominator" integer,
	"cash_amount_per_share" numeric(18, 6),
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "corporate_actions" ADD CONSTRAINT "corporate_actions_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "corporate_actions_provider_uidx" ON "corporate_actions" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "corporate_actions_effective_idx" ON "corporate_actions" USING btree ("effective_at","status");