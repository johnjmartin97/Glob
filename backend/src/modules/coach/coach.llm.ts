import { ApiError, FinishReason, GoogleGenAI } from '@google/genai';
// z.toJSONSchema() — used below to derive Gemini's responseJsonSchema from these schemas — only
// exists on the zod/v4 compat API (ships inside zod 3.25+), not the regular `zod` v3 import used
// elsewhere in this codebase. Only this file needs the v4 import.
import { z } from 'zod/v4';
import type { ExerciseCategory, ReadinessSnapshot } from '@glob/shared';
import { env } from '../../config/env';
import { HttpError } from '../../utils/errors';

export const COACH_MODEL = 'gemini-2.5-flash';

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export class LlmResponseError extends HttpError {
  constructor(message = "Coach couldn't generate a plan from that request — please try again") {
    super(502, message);
  }
}

const EXERCISE_CATEGORIES = ['squat', 'bench', 'deadlift', 'overhead_press', 'accessory', 'other'] as const;

const LlmSetSchema = z.object({
  setIndex: z.number().int().min(0),
  reps: z.number().int().min(1).max(100),
  loadKg: z.number().min(0).nullable(),
  loadPct: z.number().min(0).max(100).nullable(),
  targetRpe: z.number().min(1).max(10).nullable(),
  isWarmup: z.boolean(),
});

const LlmExerciseSchema = z.object({
  exerciseName: z.string().min(1).max(100),
  category: z.enum(EXERCISE_CATEGORIES),
  orderIndex: z.number().int().min(0),
  sets: z.array(LlmSetSchema).min(1).max(12),
  notes: z.string().max(300).nullable(),
});

const LlmSessionSchema = z.object({
  dayIndex: z.number().int().min(0),
  label: z.string().min(1).max(100),
  rationale: z.string().max(1000).nullable(),
  exercises: z.array(LlmExerciseSchema).min(1).max(10),
});

const LlmWeekSchema = z.object({
  weekIndex: z.number().int().min(0),
  focus: z.string().max(100).nullable(),
  rationale: z.string().max(1000).nullable(),
  sessions: z.array(LlmSessionSchema).min(1).max(7),
});

export const LlmPlanResponseSchema = z
  .object({
    overallRationale: z.string().min(1).max(3000),
    weeks: z.array(LlmWeekSchema).min(1).max(16),
  })
  .superRefine((data, ctx) => {
    const weekIndexes = data.weeks.map((w) => w.weekIndex).sort((a, b) => a - b);
    weekIndexes.forEach((idx, i) => {
      if (idx !== i) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `weekIndex values must be contiguous starting at 0 (got ${JSON.stringify(weekIndexes)})`,
        });
      }
    });

    for (const week of data.weeks) {
      const dayIndexes = week.sessions.map((s) => s.dayIndex).sort((a, b) => a - b);
      dayIndexes.forEach((idx, i) => {
        if (idx !== i) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `week ${week.weekIndex}: dayIndex values must be contiguous starting at 0 (got ${JSON.stringify(dayIndexes)})`,
          });
        }
      });
    }
  });

export type LlmPlanResponse = z.infer<typeof LlmPlanResponseSchema>;

const SYSTEM_PROMPT = `You are an expert powerlifting and strength coach embedded in a training-log app called Glob.

All readiness numbers you receive (training load, RPE trend, sleep, nutrition) are pre-computed by the application from the user's real logged data — never invent, estimate, or contradict them. If a data-completeness flag is false, explicitly caveat your reasoning about that area rather than asserting confidence.

Prescribe exercises using EXACTLY the names from the provided exercise list whenever a suitable match exists. Only introduce a new exercise name when nothing in the list fits (e.g. a specific accessory movement), and pick the most accurate category for it.

Respond with a complete multi-week training program matching the required schema. Do not include any prose outside the structured response.`;

export interface GeneratePlanInput {
  readiness: ReadinessSnapshot;
  goal: string;
  durationWeeks: number;
  daysPerWeek: number;
  availableExercises: Array<{ name: string; category: ExerciseCategory }>;
}

function buildUserPrompt(input: GeneratePlanInput): string {
  const { readiness, goal, durationWeeks, daysPerWeek, availableExercises } = input;

  const caveats: string[] = [];
  if (!readiness.dataCompleteness.hasEnoughSessionHistory) {
    caveats.push(
      'Sparse training history — treat acuteChronicRatio/RPE trend as low-confidence; for a near-empty history, prescribe a conservative, beginner-appropriate starting block rather than refusing to generate a plan.',
    );
  }
  if (!readiness.dataCompleteness.hasEnoughSleepHistory) {
    caveats.push(
      'Sparse sleep history — do not make strong claims about recovery from sleep; note the data gap in your rationale instead.',
    );
  }
  if (!readiness.dataCompleteness.hasNutritionTargets) {
    caveats.push('No nutrition target is set — do not assume the user is over- or under-fueling.');
  }
  if (readiness.recentExercisePerformance.length === 0) {
    caveats.push(
      'No recent per-exercise history is available yet — prescribe a conservative starting point for every lift rather than assuming any baseline.',
    );
  }

  return [
    `User request: goal="${goal}", durationWeeks=${durationWeeks}, daysPerWeek=${daysPerWeek}.`,
    '',
    'Readiness snapshot (pre-computed from real logs — ground truth, do not contradict):',
    JSON.stringify(readiness, null, 2),
    '',
    caveats.length ? `Data gaps to account for:\n- ${caveats.join('\n- ')}` : '',
    '',
    'Available exercises (use these names/categories whenever a suitable one exists):',
    JSON.stringify(availableExercises, null, 2),
    '',
    'How to use recentExercisePerformance for progressive overload:',
    "- For each prescribed lift, check whether it (or a close substitute) appears in recentExercisePerformance. If so, treat its recentSets as a short trend (most recent first), not just a single data point, and anchor your prescribed loadKg/loadPct and target RPE on that trend rather than guessing.",
    '- RPE-based progression (always available): if the most recent set\'s rpe is below the rep range\'s typical target RPE (roughly 7-8 for moderate-rep work, up to 9 near a peak), and reps/weight held steady or better across recentSets, prescribe a small load increase (~2.5-5%) or hold reps constant while nudging weight up. If the most recent rpe is at or above target, or rising across recentSets at the same load, hold the load flat or reduce it slightly and prioritize recovery.',
    '- velocityMps is the bar\'s mean concentric speed in meters/second for that set, only present when the user logs it with a velocity-tracking device — most users will NOT have this, so it will be null for most or all sets. Treat it strictly as a secondary confirmation signal alongside RPE, never as a substitute: speed holding steady or increasing across recentSets at a similar RPE supports a load increase; speed dropping noticeably session-to-session at a similar or rising RPE is a sign of accumulating fatigue and supports holding or reducing load even if RPE alone looks borderline.',
    '- If velocityMps is null for the relevant sets (the common case), base the progression decision on RPE and reps alone — do not treat a missing velocity reading as a meaningful signal of its own.',
    '- If a lift has no entry in recentExercisePerformance (new exercise, or an accessory not recently logged), prescribe a sensible conservative starting load/RPE for that lift type and the stated goal instead of inventing a fabricated history.',
    '',
    `Produce exactly ${durationWeeks} week(s) and exactly ${daysPerWeek} session(s) per week, with sensible periodization toward the stated goal. The response schema cannot enforce numeric ranges, so follow these rules exactly:`,
    `- weekIndex is the sequential position of the week: 0, 1, 2, ... up to ${durationWeeks - 1}, with no gaps or repeats.`,
    `- dayIndex is the sequential position of the session WITHIN its week: 0, 1, 2, ... up to ${daysPerWeek - 1}, with no gaps or repeats. This is the session's order, not a day-of-the-week label — do not skip numbers for rest days; rest days simply aren't represented.`,
    '- Each set\'s reps must be a whole number from 1 to 100. Prefer multiple sets over one set with an extreme rep count.',
    '- Each set\'s loadPct (percent of that exercise\'s working load) must be from 0 to 100; loadKg, if given instead, must be 0 or greater.',
    '- targetRpe is the prescribed effort (1-10) for each WORKING set, anchored on the RPE-progression guidance above (typically ~7-8 for moderate-rep work, up to ~9 near a peak). Set targetRpe to null for warmup sets.',
    '- Do NOT prescribe target velocities: the app derives each working set\'s target bar speed (m/s) from the loadPct you assign using the user\'s velocity profile. Just give an accurate loadPct (or loadKg) and targetRpe.',
    '- setIndex within an exercise starts at 0 and increases by 1 per set, in the order the sets are performed.',
  ].join('\n');
}

// Gemini's responseJsonSchema accepts a real (if restricted) JSON Schema subset, but not string
// Gemini's constrained-decoding schema doesn't support string length constraints at all, and
// chokes ("too many states for serving") on numeric min/max and array min/maxItems once they're
// nested several levels deep — which ours are (weeks -> sessions -> exercises -> sets). Strip all
// of those from what's SENT upstream; the full Zod schema (bounds included) still validates the
// response below, so nothing is actually loosened — only the request-time schema is simplified.
const UNSUPPORTED_GEMINI_SCHEMA_KEYWORDS = new Set([
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'minItems',
  'maxItems',
  '$schema',
]);

function stripUnsupportedJsonSchemaKeywords(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripUnsupportedJsonSchemaKeywords);
  }
  if (node && typeof node === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (UNSUPPORTED_GEMINI_SCHEMA_KEYWORDS.has(key)) continue;
      result[key] = stripUnsupportedJsonSchemaKeywords(value);
    }
    return result;
  }
  return node;
}

const GEMINI_RESPONSE_JSON_SCHEMA = stripUnsupportedJsonSchemaKeywords(z.toJSONSchema(LlmPlanResponseSchema));

function throwForApiError(err: ApiError): never {
  if (err.status === 503 || err.status === 429) {
    throw new LlmResponseError(
      "Coach's AI provider (Gemini free tier) is temporarily overloaded — please try again in a minute.",
    );
  }
  throw new LlmResponseError(`Coach's AI provider failed: ${err.message}`);
}

export async function generateTrainingPlan(input: GeneratePlanInput): Promise<LlmPlanResponse> {
  // A multi-week plan is a large enough generation that a single blocking generateContent() call
  // can exceed Gemini's server-side deadline (surfaces as a 504 DEADLINE_EXCEEDED), independent of
  // our own client-side timeout. Streaming avoids that single-round-trip deadline entirely.
  //
  // Use our own AbortController rather than httpOptions.timeout: the latter's internal timer isn't
  // reliably cleared once the stream finishes, so it can fire afterward and throw an uncaught error
  // from outside this function's try/catch. clearTimeout() in the finally block prevents that.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  let text = '';
  let finishReason: FinishReason | undefined;
  try {
    const stream = await client.models.generateContentStream({
      model: COACH_MODEL,
      contents: buildUserPrompt(input),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: GEMINI_RESPONSE_JSON_SCHEMA,
        thinkingConfig: { thinkingBudget: -1 },
        abortSignal: controller.signal,
      },
    });

    for await (const chunk of stream) {
      text += chunk.text ?? '';
      finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
    }
  } catch (err) {
    if (err instanceof ApiError) {
      throwForApiError(err);
    }
    throw new LlmResponseError(
      `Coach's AI provider failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (finishReason && finishReason !== FinishReason.STOP) {
    throw new LlmResponseError(
      "Coach couldn't generate a plan for that request — try adjusting your goal or duration.",
    );
  }

  if (!text) {
    throw new LlmResponseError();
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new LlmResponseError();
  }

  const result = LlmPlanResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new LlmResponseError();
  }

  return result.data;
}
