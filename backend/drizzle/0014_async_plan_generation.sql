ALTER TABLE "coaching_plans" ALTER COLUMN "rationale" DROP NOT NULL;
ALTER TABLE "coaching_plans" ADD COLUMN IF NOT EXISTS "generation_error" text;
