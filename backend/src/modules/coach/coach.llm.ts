import { readFileSync } from 'node:fs';
import OpenAI from 'openai';
import { z } from 'zod/v4';
import type { ExerciseCategory, ReadinessSnapshot } from '@glob/shared';
import { env } from '../../config/env';
import { HttpError } from '../../utils/errors';

export const COACH_MODEL = env.LLM_MODEL;

// OpenAI-compatible client; defaults to a locally-hosted Ollama model (LLM_BASE_URL), but works with
// any OpenAI-compatible server/cloud provider. maxRetries gives exponential backoff on 429/5xx.
const client = new OpenAI({
  apiKey: env.LLM_API_KEY,
  baseURL: env.LLM_BASE_URL,
  // Keep low: local servers don't rate-limit, and retries × the request timeout otherwise delay
  // surfacing the real error. Our app-level loop handles validation retries.
  maxRetries: 2,
  timeout: 180_000,
});

/** Recursively strips JSON Schema keys some constrained-decoding engines reject (e.g. `$schema`). */
function stripSchemaMeta(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripSchemaMeta);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === '$schema') continue;
      out[k] = stripSchemaMeta(v);
    }
    return out;
  }
  return node;
}

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
  targetRpe: z.number().min(1).max(10).nullable().optional(),
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
    overallRationale: z.string().min(1).max(1200),
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

Respond with a complete multi-week training program matching the required schema, as a single raw JSON object. Do not include any prose, markdown, or code fences outside the JSON object.`;

export interface GeneratePlanInput {
  readiness: ReadinessSnapshot;
  goal: string;
  durationWeeks: number;
  daysPerWeek: number;
  availableExercises: Array<{ name: string; category: ExerciseCategory }>;
}

// User-editable coaching wisdom, loaded per request so edits take effect without a restart. The file
// has a shared base section followed by `## <goal>` sections; we return base + the matching goal.
const PRINCIPLES_URL = new URL('./coaching-principles.md', import.meta.url);
function loadCoachingPrinciples(goal: string): string {
  let raw: string;
  try {
    raw = readFileSync(PRINCIPLES_URL, 'utf8');
  } catch (err) {
    console.warn('[coach.llm] coaching-principles.md not loaded; generating without it:', err);
    return '';
  }
  const base: string[] = [];
  const sections = new Map<string, string[]>();
  let current = base;
  for (const line of raw.split('\n')) {
    const header = /^##\s+(.+?)\s*$/.exec(line);
    if (header) {
      current = [];
      sections.set(header[1]!.trim().toLowerCase(), current);
    } else {
      current.push(line);
    }
  }
  const goalSection = sections.get(goal.trim().toLowerCase()) ?? [];
  return [base.join('\n').trim(), goalSection.join('\n').trim()].filter(Boolean).join('\n\n');
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

  const principles = loadCoachingPrinciples(goal);

  return [
    `User request: goal="${goal}", durationWeeks=${durationWeeks}, daysPerWeek=${daysPerWeek}.`,
    '',
    principles
      ? `Coaching principles to apply (respect them where the ${daysPerWeek}-day schedule and "${goal}" goal allow):\n${principles}\n`
      : '',
    'Readiness snapshot (pre-computed from real logs — ground truth, do not contradict):',
    JSON.stringify(readiness),
    '',
    caveats.length ? `Data gaps to account for:\n- ${caveats.join('\n- ')}` : '',
    '',
    'Available exercises (use these names/categories whenever a suitable one exists):',
    JSON.stringify(availableExercises),
    '',
    'How to use recentExercisePerformance for progressive overload:',
    "- For each prescribed lift, check whether it (or a close substitute) appears in recentExercisePerformance. If so, treat its recentSets as a short trend (most recent first), not just a single data point, and anchor your prescribed loadKg/loadPct and target RPE on that trend rather than guessing.",
    '- RPE-based progression (always available): if the most recent set\'s rpe is below the rep range\'s typical target RPE (roughly 7-8 for moderate-rep work, up to 9 near a peak), and reps/weight held steady or better across recentSets, prescribe a small load increase (~2.5-5%) or hold reps constant while nudging weight up. If the most recent rpe is at or above target, or rising across recentSets at the same load, hold the load flat or reduce it slightly and prioritize recovery.',
    '- velocityMps is the bar\'s mean concentric speed in meters/second for that set, only present when the user logs it with a velocity-tracking device — most users will NOT have this, so it will be null for most or all sets. Treat it strictly as a secondary confirmation signal alongside RPE, never as a substitute: speed holding steady or increasing across recentSets at a similar RPE supports a load increase; speed dropping noticeably session-to-session at a similar or rising RPE is a sign of accumulating fatigue and supports holding or reducing load even if RPE alone looks borderline.',
    '- If velocityMps is null for the relevant sets (the common case), base the progression decision on RPE and reps alone — do not treat a missing velocity reading as a meaningful signal of its own.',
    '- If a lift has no entry in recentExercisePerformance (new exercise, or an accessory not recently logged), prescribe a sensible conservative starting load/RPE for that lift type and the stated goal instead of inventing a fabricated history.',
    '',
    'Return ONLY a single JSON object of EXACTLY this shape (no extra keys, no markdown):',
    '{"overallRationale": string, "weeks": [{"weekIndex": int, "focus": string|null, "rationale": string|null, "sessions": [{"dayIndex": int, "label": string, "rationale": string|null, "exercises": [{"exerciseName": string, "category": "squat"|"bench"|"deadlift"|"overhead_press"|"accessory"|"other", "orderIndex": int, "notes": string|null, "sets": [{"setIndex": int, "reps": int, "loadKg": number|null, "loadPct": number|null, "targetRpe": number|null, "isWarmup": boolean}]}]}]}]}',
    '',
    `Produce exactly ${durationWeeks} week(s) and exactly ${daysPerWeek} session(s) per week, with sensible periodization toward the stated goal. Follow these rules exactly:`,
    `- weekIndex is the sequential position of the week: 0, 1, 2, ... up to ${durationWeeks - 1}, with no gaps or repeats.`,
    `- dayIndex is the sequential position of the session WITHIN its week: 0, 1, 2, ... up to ${daysPerWeek - 1}, with no gaps or repeats. This is the session's order, not a day-of-the-week label — do not skip numbers for rest days; rest days simply aren't represented.`,
    '- Each set\'s reps must be a whole number from 1 to 100. Prefer multiple sets over one set with an extreme rep count.',
    '- Output WORKING SETS ONLY — do NOT include any warmup sets (isWarmup must be false for every set). The app adds warmups automatically. Keep set counts realistic (about 3-5 working sets per exercise, 3-5 exercises per session).',
    '- Keep all text fields brief to stay within length limits: overallRationale at most 2 sentences; each week/session rationale at most 1 short sentence; notes null or a few words.',
    '- For the MAIN barbell lifts (categories squat, bench, deadlift): prescribe reps and targetRpe ONLY — the app computes the actual kg load from the lifter\'s estimated 1RM and your reps/RPE, so do NOT try to set loadKg/loadPct for them (any value you give is ignored). Drive the periodization for these lifts through reps and targetRpe (e.g. wave RPE up week to week, or lower reps as intensity rises).',
    '- For ACCESSORY/other working sets: give loadPct (percent of that exercise\'s working load, a number 0-100, e.g. 90 for 90%, NOT 0.9) or loadKg (0 or greater), plus targetRpe when you can.',
    '- targetRpe is the prescribed effort (1-10) for each set, anchored on the RPE-progression guidance above (typically ~7-8 for moderate-rep work, up to ~9 near a peak). ALWAYS set targetRpe for every set of the main barbell lifts; it is strongly preferred on accessory sets too.',
    '- Do NOT prescribe target velocities: the app derives each working set\'s target bar speed (m/s) itself.',
    '- setIndex within an exercise starts at 0 and increases by 1 per set, in the order the sets are performed.',
  ].join('\n');
}

/** Truncates long model output for logging: keeps the head and tail. */
function snippet(text: string, max = 500): string {
  if (text.length <= max * 2) return text;
  return `${text.slice(0, max)} …[${text.length - max * 2} chars omitted]… ${text.slice(-max)}`;
}

function logLlmFailure(stage: string, details: Record<string, unknown>): void {
  console.error(`[coach.llm] plan generation failed at ${stage}`, details);
}

const MAX_VALIDATION_ATTEMPTS = 3;

// json_schema turns on Ollama's constrained decoding (guaranteed-valid structure — key to making a
// small local model reliable); json_object is the portable fallback. Either way the Zod schema below
// still validates the semantics (ranges, week/day contiguity) the structure constraint can't enforce.
const RESPONSE_FORMAT: OpenAI.Chat.Completions.ChatCompletionCreateParams['response_format'] =
  env.LLM_RESPONSE_FORMAT === 'json_schema'
    ? {
        type: 'json_schema',
        json_schema: {
          name: 'training_plan',
          schema: stripSchemaMeta(z.toJSONSchema(LlmPlanResponseSchema)) as Record<string, unknown>,
        },
      }
    : { type: 'json_object' };

/** One streamed completion. The SDK's maxRetries handles transient 429/5xx with backoff. */
async function requestPlanOnce(
  input: GeneratePlanInput,
): Promise<{ text: string; finishReason: string | null | undefined }> {
  let text = '';
  let finishReason: string | null | undefined;
  const stream = await client.chat.completions.create({
    model: COACH_MODEL,
    stream: true,
    // Cap completion so prompt + output fit the model's context window (Ollama: set OLLAMA_CONTEXT_LENGTH
    // large enough, e.g. 16384) and, on metered providers, stay under the per-minute token limit.
    max_completion_tokens: 12000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    response_format: RESPONSE_FORMAT,
  });
  for await (const chunk of stream) {
    text += chunk.choices[0]?.delta?.content ?? '';
    finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
  }
  return { text, finishReason };
}

// Logs the underlying request error in full and returns an accurate user-facing error. The whole
// point: make the real cause (connection refused, timeout, Ollama 500 + body, 4xx, …) visible in the
// server logs instead of collapsing everything to "overloaded".
function mapAndLogLlmError(err: unknown, attempt: number): LlmResponseError {
  const where = { baseURL: env.LLM_BASE_URL, model: COACH_MODEL, attempt };
  if (err instanceof OpenAI.APIError) {
    logLlmFailure('request error', {
      ...where,
      name: err.name,
      status: err.status,
      code: err.code,
      type: err.type,
      message: err.message,
      body: err.error,
    });
    if (err instanceof OpenAI.APIConnectionTimeoutError) {
      return new LlmResponseError(
        'The coach model took too long to respond — it may be slow or still loading. Please try again.',
      );
    }
    if (err instanceof OpenAI.APIConnectionError) {
      return new LlmResponseError(
        `Couldn't reach the coach model server at ${env.LLM_BASE_URL} — make sure it's running.`,
      );
    }
    if (err.status === 429) {
      return new LlmResponseError('The coach AI provider is rate-limiting — please try again in a minute.');
    }
    if (err.status != null && err.status >= 500) {
      return new LlmResponseError(
        `The coach model server returned an error (HTTP ${err.status}). Check the server logs for details.`,
      );
    }
    if (err.status != null) {
      return new LlmResponseError(`The coach request was rejected (HTTP ${err.status}): ${err.message}`);
    }
    return new LlmResponseError(`Coach's AI provider failed: ${err.message}`);
  }
  logLlmFailure('request error (non-API)', {
    ...where,
    message: err instanceof Error ? err.message : String(err),
  });
  return new LlmResponseError(
    `Coach's AI provider failed: ${err instanceof Error ? err.message : String(err)}`,
  );
}

export async function generateTrainingPlan(input: GeneratePlanInput): Promise<LlmPlanResponse> {
  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
    let text = '';
    let finishReason: string | null | undefined;
    try {
      ({ text, finishReason } = await requestPlanOnce(input));
    } catch (err) {
      throw mapAndLogLlmError(err, attempt);
    }

    // Truncation won't fix itself on retry — fail fast with an actionable message.
    if (finishReason === 'length') {
      logLlmFailure('truncated (length)', { finishReason, textLength: text.length, text: snippet(text) });
      throw new LlmResponseError(
        "Coach couldn't generate a plan for that request — try a shorter duration or fewer days per week.",
      );
    }

    const last = attempt === MAX_VALIDATION_ATTEMPTS;

    if (!text) {
      logLlmFailure('empty response', { finishReason, attempt });
      if (last) throw new LlmResponseError();
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch (err) {
      logLlmFailure('JSON parse', {
        error: err instanceof Error ? err.message : String(err),
        textLength: text.length,
        text: snippet(text),
        attempt,
      });
      if (last) throw new LlmResponseError();
      continue;
    }

    const result = LlmPlanResponseSchema.safeParse(parsedJson);
    if (result.success) {
      // Enforce the requested size — a small model often under-produces (e.g. 1 week when 4 were
      // asked for). Such a plan is structurally valid but wrong, so retry instead of persisting it.
      const weeksOk = result.data.weeks.length === input.durationWeeks;
      const daysOk = result.data.weeks.every((w) => w.sessions.length === input.daysPerWeek);
      if (weeksOk && daysOk) return result.data;
      logLlmFailure('wrong plan size', {
        wantWeeks: input.durationWeeks,
        gotWeeks: result.data.weeks.length,
        wantDays: input.daysPerWeek,
        gotDays: result.data.weeks.map((w) => w.sessions.length),
        attempt,
      });
      if (last) throw new LlmResponseError();
      continue;
    }

    logLlmFailure('schema validation', { issues: result.error.issues, text: snippet(text), attempt });
    if (last) throw new LlmResponseError();
  }

  // Unreachable (the loop either returns or throws on the last attempt), but satisfies the type checker.
  throw new LlmResponseError();
}
