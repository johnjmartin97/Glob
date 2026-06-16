ALTER TABLE "exercises" ADD COLUMN "weight_unit" text DEFAULT 'kg' NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "warmup_reps_per_set" integer[];