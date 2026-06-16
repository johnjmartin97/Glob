export type WeightUnit = 'kg' | 'lb';
export type Theme = 'dark' | 'light' | 'system';

export type ExerciseCategory =
  | 'squat'
  | 'bench'
  | 'deadlift'
  | 'overhead_press'
  | 'accessory'
  | 'other';

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
  setsConfig: Array<{ loadKg: number | null; reps: number | null }> | null;
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
  actualWeightKg: number | null;
  actualReps: number | null;
  actualRpe: number | null;
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
