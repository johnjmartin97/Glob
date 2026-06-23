CREATE TABLE "coaching_plan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"label" text NOT NULL,
	"template_id" uuid NOT NULL,
	"session_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"rationale" text,
	"status_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_plan_sessions_week_id_day_index_unique" UNIQUE("week_id","day_index")
);
--> statement-breakpoint
CREATE TABLE "coaching_plan_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"week_index" integer NOT NULL,
	"focus" text,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_plan_weeks_plan_id_week_index_unique" UNIQUE("plan_id","week_index")
);
--> statement-breakpoint
CREATE TABLE "coaching_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"goal" text NOT NULL,
	"duration_weeks" integer NOT NULL,
	"days_per_week" integer NOT NULL,
	"start_date" date NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" text NOT NULL,
	"readiness_snapshot" json NOT NULL,
	"rationale" text NOT NULL,
	"raw_llm_response" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "coaching_plan_sessions" ADD CONSTRAINT "coaching_plan_sessions_plan_id_coaching_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."coaching_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_plan_sessions" ADD CONSTRAINT "coaching_plan_sessions_week_id_coaching_plan_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."coaching_plan_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_plan_sessions" ADD CONSTRAINT "coaching_plan_sessions_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_plan_sessions" ADD CONSTRAINT "coaching_plan_sessions_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_plan_weeks" ADD CONSTRAINT "coaching_plan_weeks_plan_id_coaching_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."coaching_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_plans" ADD CONSTRAINT "coaching_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coaching_plans_one_active_idx" ON "coaching_plans" USING btree ("user_id") WHERE "coaching_plans"."status" = 'active';