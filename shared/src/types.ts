export type WeightUnit = 'kg' | 'lb';
export type Theme = 'dark' | 'light' | 'system';

export type ExerciseCategory =
  | 'squat'
  | 'bench'
  | 'deadlift'
  | 'overhead_press'
  | 'accessory'
  | 'other';

// The competition lifts the coach prescribes velocity for (and autoregulates).
export const MAIN_LIFT_CATEGORIES: ExerciseCategory[] = ['squat', 'bench', 'deadlift'];

export type SetType = 'warmup' | 'working';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface UserSettings {
  weightUnit: WeightUnit;
  timezone: string;
  theme: Theme;
}

export interface Exercise {
  id: string;
  userId: string | null;
  name: string;
  category: ExerciseCategory;
  isSystem: boolean;
  weightUnit: WeightUnit;
  logRpe: boolean;
  logVelocity: boolean;
}

export interface TemplateExercise {
  id: string;
  exerciseId: string;
  exercise?: Exercise;
  orderIndex: number;
  targetSets: number;
  targetReps: number | null;
  targetLoadKg: number | null;
  targetLoadPct: number | null;
  referenceLiftId: string | null;
  notes: string | null;
  warmupEnabled: boolean;
  warmupSetCount: number | null;
  warmupPercentages: number[] | null;
  warmupRepsPerSet: number[] | null;
  setsConfig: Array<{
    loadKg: number | null;
    reps: number | null;
    rpe: number | null;
    velocityMps: number | null;
  }> | null;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  notes: string | null;
  exercises: TemplateExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionSet {
  id: string;
  setIndex: number;
  setType: SetType;
  prescribedReps: number | null;
  prescribedLoadKg: number | null;
  prescribedRpe: number | null;
  prescribedVelocityMps: number | null;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualRpe: number | null;
  actualVelocityMps: number | null;
  completed: boolean;
  completedAt: string | null;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  exercise?: Exercise;
  orderIndex: number;
  templateExerciseId: string | null;
  notes: string | null;
  sets: SessionSet[];
}

export interface WorkoutSession {
  id: string;
  templateId: string | null;
  name: string;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  exercises: SessionExercise[];
}

export interface NutritionTarget {
  effectiveDate: string;
  caloriesTarget: number;
  proteinGTarget: number | null;
  carbsGTarget: number | null;
  fatGTarget: number | null;
}

export interface FoodItem {
  id: string;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ExternalFoodResult {
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodLogEntry {
  id: string;
  foodItemId: string;
  foodItem?: FoodItem;
  logDate: string;
  mealType: MealType;
  servings: number;
  loggedAt: string;
}

export interface MacroTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Supplement {
  id: string;
  name: string;
  dosage: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface SupplementLog {
  supplementId: string;
  logDate: string;
  taken: boolean;
}

export interface SleepLog {
  logDate: string;
  hoursSlept: number;
  hoursInBed: number | null;
  qualityRating: number | null;
  notes: string | null;
}

export type CoachGoal = 'strength' | 'hypertrophy' | 'peaking' | 'general_fitness';
export type CoachingPlanStatus = 'active' | 'completed' | 'abandoned' | 'superseded';
export type CoachingPlanSessionStatus = 'pending' | 'completed' | 'skipped';
export type RpeTrendDirection = 'rising' | 'falling' | 'flat' | 'insufficient_data';

export interface ReadinessSnapshot {
  asOfDate: string;
  trainingLoad: {
    acuteVolumeKg: number;
    chronicVolumeKgPerWeek: number;
    acuteChronicRatio: number | null;
    sessionsLast7Days: number;
    sessionsLast28Days: number;
  };
  rpeTrend: {
    avgWorkingRpeLast7Days: number | null;
    avgWorkingRpeLast28Days: number | null;
    trendDirection: RpeTrendDirection;
  };
  sleep: {
    avgHoursLast7Days: number | null;
    avgHoursLast28Days: number | null;
    sleepDebtHours: number;
    nightsLoggedLast7Days: number;
  };
  nutrition: {
    avgCaloriesLast7Days: number | null;
    targetCalories: number | null;
    caloriesAdequacyPct: number | null;
    avgProteinGLast7Days: number | null;
    targetProteinG: number | null;
    proteinAdequacyPct: number | null;
    daysLoggedLast7Days: number;
  };
  // Most-frequently-trained exercises in the last 28 days (min. 1 qualifying set in the last 14),
  // each with up to 3 most-recent top-set data points (most recent first) for trend-aware
  // progressive-overload prescriptions. Historical coachingPlans rows generated before this field
  // existed will have the old `perLiftRecent` shape instead — this snapshot isn't migrated.
  recentExercisePerformance: Array<{
    exerciseName: string;
    category: ExerciseCategory;
    recentSets: Array<{
      daysAgo: number;
      weightKg: number;
      reps: number;
      rpe: number | null;
      velocityMps: number | null;
    }>;
  }>;
  dataCompleteness: {
    hasEnoughSessionHistory: boolean;
    hasEnoughSleepHistory: boolean;
    hasNutritionTargets: boolean;
  };
}

export interface CoachingPlanSummary {
  id: string;
  status: CoachingPlanStatus;
  goal: CoachGoal;
  durationWeeks: number;
  daysPerWeek: number;
  startDate: string;
  generatedAt: string;
  weekCount: number;
  sessionCount: number;
  completedSessionCount: number;
}

export interface CoachingPlanSessionDetail {
  id: string;
  weekId: string;
  dayIndex: number;
  label: string;
  templateId: string;
  sessionId: string | null;
  status: CoachingPlanSessionStatus;
  rationale: string | null;
  exercises: TemplateExercise[];
}

export interface CoachingPlanWeekDetail {
  id: string;
  weekIndex: number;
  focus: string | null;
  rationale: string | null;
  sessions: CoachingPlanSessionDetail[];
}

export interface CoachingPlanDetail {
  id: string;
  status: CoachingPlanStatus;
  goal: CoachGoal;
  durationWeeks: number;
  daysPerWeek: number;
  startDate: string;
  generatedAt: string;
  model: string;
  readinessSnapshot: ReadinessSnapshot;
  rationale: string;
  weeks: CoachingPlanWeekDetail[];
}
