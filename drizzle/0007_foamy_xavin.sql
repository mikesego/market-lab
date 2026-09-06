CREATE TABLE "corporate_action_applications" (
	"action_id" uuid NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "corporate_action_applications_action_id_portfolio_id_pk" PRIMARY KEY("action_id","portfolio_id")
);
--> statement-breakpoint
ALTER TABLE "corporate_action_applications" ADD CONSTRAINT "corporate_action_applications_action_id_corporate_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."corporate_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_action_applications" ADD CONSTRAINT "corporate_action_applications_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;