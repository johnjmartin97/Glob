import type { ExerciseCategory } from './types.js';

/**
 * A linear load–velocity profile (LVP): mean concentric velocity (m/s) as a roughly linear
 * function of load expressed as %1RM. `velocity = intercept + slope * loadPct`.
 * `minVelocity` is the minimal velocity threshold (≈ the velocity at a true 1RM) — predictions
 * are clamped to not fall below it.
 */
export interface LoadVelocityProfile {
  slope: number;
  intercept: number;
  minVelocity: number;
}

/** Builds a linear profile from two (loadPct, velocity) anchors; minVelocity defaults to the higher-% anchor. */
function profileFromAnchors(
  lowPct: number,
  lowVelocity: number,
  highPct: number,
  highVelocity: number,
): LoadVelocityProfile {
  const slope = (highVelocity - lowVelocity) / (highPct - lowPct);
  const intercept = lowVelocity - slope * lowPct;
  return { slope, intercept, minVelocity: Math.min(lowVelocity, highVelocity) };
}

/**
 * Generic default mean-velocity profiles per lift category, anchored at 50% and 100% of 1RM.
 * Used until a user has logged enough velocity data to fit their own profile.
 */
export const DEFAULT_LOAD_VELOCITY_PROFILES: Record<ExerciseCategory, LoadVelocityProfile> = {
  squat: profileFromAnchors(50, 0.7, 100, 0.3),
  bench: profileFromAnchors(50, 0.55, 100, 0.15),
  deadlift: profileFromAnchors(50, 0.5, 100, 0.18),
  overhead_press: profileFromAnchors(50, 0.55, 100, 0.18),
  accessory: profileFromAnchors(50, 0.65, 100, 0.25),
  other: profileFromAnchors(50, 0.65, 100, 0.25),
};

/** Predicted target mean velocity (m/s) for a given load (%1RM), clamped to the profile's MVT. */
export function targetVelocityForLoadPct(loadPct: number, profile: LoadVelocityProfile): number {
  const predicted = profile.intercept + profile.slope * loadPct;
  return Math.max(profile.minVelocity, predicted);
}

/**
 * Estimates the %1RM a completed set represents from its reps and RPE.
 * RIR = 10 − RPE, so reps-to-failure = reps + RIR; %1RM via the (inverse) Epley relation,
 * normalised so a single rep to failure (RPE 10) maps to 100%.
 */
export function loadPctFromRepsRpe(reps: number, rpe: number): number {
  const repsToFailure = reps + (10 - rpe);
  const pct = 100 / (1 + 0.0333 * (repsToFailure - 1));
  return Math.min(100, Math.max(1, pct));
}

/** A lift needs at least this many spread-out velocity points before we trust a personal fit. */
export const MIN_PROFILE_POINTS = 5;
export const MIN_LOADPCT_SPREAD = 20;

/**
 * Least-squares linear fit of velocity against loadPct. Returns null when there are too few points
 * or they don't span enough of the load range to define a meaningful slope (falls back to default).
 */
export function fitLoadVelocityProfile(
  points: Array<{ loadPct: number; velocityMps: number }>,
): LoadVelocityProfile | null {
  if (points.length < MIN_PROFILE_POINTS) return null;

  const minPct = Math.min(...points.map((p) => p.loadPct));
  const maxPct = Math.max(...points.map((p) => p.loadPct));
  if (maxPct - minPct < MIN_LOADPCT_SPREAD) return null;

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.loadPct, 0);
  const sumY = points.reduce((s, p) => s + p.velocityMps, 0);
  const sumXY = points.reduce((s, p) => s + p.loadPct * p.velocityMps, 0);
  const sumXX = points.reduce((s, p) => s + p.loadPct * p.loadPct, 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  // MVT = predicted velocity at 100% 1RM, floored at a small positive value.
  const minVelocity = Math.max(0.05, intercept + slope * 100);
  return { slope, intercept, minVelocity };
}
