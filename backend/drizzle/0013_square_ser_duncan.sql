CREATE TABLE "coaching_plan_lifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"estimated_1rm_kg" numeric(6, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_plan_lifts_plan_id_exercise_id_unique" UNIQUE("plan_id","exercise_id")
);
--> statement-breakpoint
ALTER TABLE "coaching_plan_lifts" ADD CONSTRAINT "coaching_plan_lifts_plan_id_coaching_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."coaching_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_plan_lifts" ADD CONSTRAINT "coaching_plan_lifts_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;