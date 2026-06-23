import { eq, isNull } from 'drizzle-orm';
import {
  BAR_WEIGHT_KG,
  calculateWarmupSets,
  DEFAULT_WARMUP_PERCENTAGES,
  DEFAULT_WARMUP_REPS_PER_SET,
  loadPctFromRepsRpe,
  roundToNearestIncrement,
  type ExerciseCategory,
} from '@glob/shared';
import { sql, db } from './client';
import {
  exercises,
  foodItems,
  foodLogEntries,
  nutritionTargets,
  sessionExercises,
  sessionSets,
  sleepLogs,
  supplementLogs,
  supplements,
  userExerciseSettings,
  users,
  userSettings,
  workoutSessions,
} from './schema/index';
import { hashPassword } from '../utils/password';

// ---------------------------------------------------------------------------
// Config (override email/password via env)
// ---------------------------------------------------------------------------
const EMAIL = process.env.SEED_USER_EMAIL ?? 'lifter@glob.test';
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';
const DISPLAY_NAME = 'Test Lifter';

const CURRENT_1RM: Record<string, number> = {
  Squat: 175,
  'Bench Press': 115,
  Deadlift: 235,
};

const WEEKS = 12;
const DAYS_PER_WEEK = 4;

// Same system exercises as src/db/seed.ts — ensure they exist before we reference them.
const SYSTEM_EXERCISES: { name: string; category: ExerciseCategory }[] = [
  { name: 'Squat', category: 'squat' },
  { name: 'Front Squat', category: 'squat' },
  { name: 'Bench Press', category: 'bench' },
  { name: 'Close-Grip Bench Press', category: 'bench' },
  { name: 'Deadlift', category: 'deadlift' },
  { name: 'Sumo Deadlift', category: 'deadlift' },
  { name: 'Romanian Deadlift', category: 'deadlift' },
  { name: 'Overhead Press', category: 'overhead_press' },
  { name: 'Barbell Row', category: 'accessory' },
  { name: 'Pull-Up', category: 'accessory' },
  { name: 'Leg Press', category: 'accessory' },
  { name: 'Bicep Curl', category: 'accessory' },
  { name: 'Tricep Pushdown', category: 'accessory' },
  { name: 'Lat Pulldown', category: 'accessory' },
  { name: 'Plank', category: 'other' },
];

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------
let rngState = 987654321;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
/** Uniform jitter in [-mag, mag]. */
function jitter(mag: number): number {
  return (rand() * 2 - 1) * mag;
}

function n(value: number | null | undefined): string | null {
  return value == null ? null : String(value);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TODAY = new Date();

function daysAgoDate(days: number): Date {
  return new Date(TODAY.getTime() - days * MS_PER_DAY);
}
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Velocity: a "true" per-lift load–velocity line (anchors at 70% and 95% 1RM),
// intentionally distinct from the app defaults so personalization is observable.
// ---------------------------------------------------------------------------
const TRUE_LVP: Record<string, { v70: number; v95: number }> = {
  Squat: { v70: 0.62, v95: 0.32 },
  'Bench Press': { v70: 0.45, v95: 0.18 },
  Deadlift: { v70: 0.4, v95: 0.2 },
};

function trueVelocity(lift: string, loadPct: number): number {
  const a = TRUE_LVP[lift]!;
  const slope = (a.v95 - a.v70) / (95 - 70);
  const v = a.v70 + slope * (loadPct - 70) + jitter(0.025);
  return Math.max(0.12, Math.round(v * 100) / 100);
}

// ---------------------------------------------------------------------------
// Training scheme
// ---------------------------------------------------------------------------
// Working-set (reps, rpe) per main lift for a given week. Undulates so each lift
// accumulates velocity points across a wide load range; final week tests a single.
function mainScheme(week: number): Array<{ reps: number; rpe: number }> {
  if (week === WEEKS - 1) {
    return [
      { reps: 1, rpe: 10 }, // exact 1RM test
      { reps: 3, rpe: 8 },
    ];
  }
  switch (week % 3) {
    case 0:
      return [
        { reps: 8, rpe: 7 }, // ~75% volume
        { reps: 5, rpe: 7 },
        { reps: 5, rpe: 8 },
      ];
    case 1:
      return [
        { reps: 5, rpe: 8 },
        { reps: 3, rpe: 8 },
        { reps: 3, rpe: 9 },
      ];
    default:
      return [
        { reps: 2, rpe: 8 }, // heavier
        { reps: 1, rpe: 9 },
        { reps: 4, rpe: 7 }, // back-off
      ];
  }
}

function weekE1RM(lift: string, week: number): number {
  const target = CURRENT_1RM[lift]!;
  const frac = 0.9 + 0.1 * (week / (WEEKS - 1));
  return target * frac;
}

interface DayPlan {
  label: string;
  main: string | null; // VBT'd main lift
  accessories: Array<{ name: string; sets: number; reps: number; rpe: number; baseKg: number }>;
}

// Exactly 8 distinct exercises across the program, so none get dropped from the
// coach's top-8 recentExercisePerformance ranking.
const DAY_PLANS: DayPlan[] = [
  {
    label: 'Squat',
    main: 'Squat',
    accessories: [{ name: 'Leg Press', sets: 3, reps: 10, rpe: 8, baseKg: 200 }],
  },
  {
    label: 'Bench',
    main: 'Bench Press',
    accessories: [{ name: 'Tricep Pushdown', sets: 3, reps: 12, rpe: 8, baseKg: 35 }],
  },
  {
    label: 'Deadlift',
    main: 'Deadlift',
    accessories: [{ name: 'Barbell Row', sets: 4, reps: 8, rpe: 8, baseKg: 100 }],
  },
  {
    label: 'Overhead / Upper',
    main: null,
    accessories: [
      { name: 'Overhead Press', sets: 3, reps: 5, rpe: 8, baseKg: 65 },
      { name: 'Pull-Up', sets: 3, reps: 8, rpe: 8, baseKg: 0 },
    ],
  },
];

// Day offsets within each 7-day week (e.g. Mon/Wed/Fri/Sun), so the program spans
// real calendar weeks with rest days rather than consecutive days.
const DAY_OFFSETS = [0, 2, 4, 6];
const MAX_ABS_DAY = (WEEKS - 1) * 7 + DAY_OFFSETS[DAYS_PER_WEEK - 1]!;

// ---------------------------------------------------------------------------
// Nutrition / sleep / supplements data
// ---------------------------------------------------------------------------
const FOOD_ITEMS = [
  { name: 'Chicken Breast', brand: null, servingSize: 100, servingUnit: 'g', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  { name: 'White Rice (cooked)', brand: null, servingSize: 100, servingUnit: 'g', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
  { name: 'Rolled Oats', brand: null, servingSize: 100, servingUnit: 'g', calories: 389, proteinG: 16.9, carbsG: 66, fatG: 6.9 },
  { name: 'Whey Protein', brand: 'Generic', servingSize: 30, servingUnit: 'g', calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5 },
  { name: 'Whole Egg', brand: null, servingSize: 50, servingUnit: 'g', calories: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8 },
  { name: 'Olive Oil', brand: null, servingSize: 14, servingUnit: 'g', calories: 119, proteinG: 0, carbsG: 0, fatG: 13.5 },
  { name: 'Greek Yogurt', brand: null, servingSize: 170, servingUnit: 'g', calories: 100, proteinG: 17, carbsG: 6, fatG: 0.7 },
  { name: 'Banana', brand: null, servingSize: 118, servingUnit: 'g', calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4 },
] as const;

// Daily intake template: [foodName, mealType, servings]
const DAILY_MEALS: Array<[string, string, number]> = [
  ['Rolled Oats', 'breakfast', 2],
  ['Whey Protein', 'breakfast', 1],
  ['Banana', 'breakfast', 1],
  ['Chicken Breast', 'lunch', 2],
  ['White Rice (cooked)', 'lunch', 3],
  ['Olive Oil', 'lunch', 1],
  ['Chicken Breast', 'dinner', 2],
  ['White Rice (cooked)', 'dinner', 3],
  ['Greek Yogurt', 'dinner', 1],
  ['Whey Protein', 'snack', 1],
  ['Banana', 'snack', 1],
  ['Olive Oil', 'snack', 1],
];

const NUTRITION_LOG_DAYS = 28;
const SLEEP_LOG_DAYS = 28;
const SUPPLEMENT_LOG_DAYS = 28;

const SUPPLEMENTS = [
  { name: 'Creatine', dosage: '5 g' },
  { name: 'Vitamin D3', dosage: '4000 IU' },
  { name: 'Whey Protein', dosage: '1 scoop' },
];

// ---------------------------------------------------------------------------
async function main() {
  // Ensure system exercises exist (idempotent), then map name -> id.
  for (const exercise of SYSTEM_EXERCISES) {
    await db
      .insert(exercises)
      .values({ ...exercise, userId: null, isSystem: true })
      .onConflictDoNothing();
  }
  const systemRows = await db.query.exercises.findMany({ where: isNull(exercises.userId) });
  const exerciseIdByName = new Map(systemRows.map((e) => [e.name, e.id]));

  const counts = { sessions: 0, sets: 0, foodLogs: 0, sleepLogs: 0, supplementLogs: 0 };

  await db.transaction(async (tx) => {
    // Fresh start: cascade-deletes all of this user's data.
    await tx.delete(users).where(eq(users.email, EMAIL));

    const passwordHash = await hashPassword(PASSWORD);
    const [user] = await tx
      .insert(users)
      .values({ email: EMAIL, passwordHash, displayName: DISPLAY_NAME })
      .returning();
    const userId = user!.id;

    await tx.insert(userSettings).values({ userId, weightUnit: 'kg', timezone: 'UTC', theme: 'dark' });

    // Enable RPE + velocity logging for the three main lifts so the UI shows them.
    for (const lift of Object.keys(CURRENT_1RM)) {
      await tx.insert(userExerciseSettings).values({
        userId,
        exerciseId: exerciseIdByName.get(lift)!,
        logRpe: true,
        logVelocity: true,
      });
    }

    // ----- Training: WEEKS x DAYS_PER_WEEK sessions, most recent last -----
    const totalSessions = WEEKS * DAYS_PER_WEEK;
    for (let s = 0; s < totalSessions; s++) {
      const week = Math.floor(s / DAYS_PER_WEEK);
      const dayInWeek = s % DAYS_PER_WEEK;
      const plan = DAY_PLANS[dayInWeek]!;
      // Space sessions across real weeks (rest days between); newest is ~1 day ago.
      const absoluteDay = week * 7 + DAY_OFFSETS[dayInWeek]!;
      const daysAgo = MAX_ABS_DAY - absoluteDay + 1;
      const started = daysAgoDate(daysAgo);
      started.setHours(17, 0, 0, 0);
      const completed = new Date(started.getTime() + 60 * 60 * 1000);

      const [session] = await tx
        .insert(workoutSessions)
        .values({
          userId,
          name: `${plan.label} Day`,
          startedAt: started,
          completedAt: completed,
        })
        .returning();
      counts.sessions++;

      let orderIndex = 0;

      // Main (VBT'd) lift: warmups + working sets.
      if (plan.main) {
        const lift = plan.main;
        const e1rm = weekE1RM(lift, week);
        const working = mainScheme(week).map(({ reps, rpe }) => {
          const loadPct = loadPctFromRepsRpe(reps, rpe);
          const weightKg = roundToNearestIncrement(Math.max(BAR_WEIGHT_KG, (e1rm * loadPct) / 100), 2.5);
          return { reps, rpe, weightKg, velocity: trueVelocity(lift, loadPct) };
        });
        const topWeight = Math.max(...working.map((w) => w.weightKg));

        const [sessEx] = await tx
          .insert(sessionExercises)
          .values({ sessionId: session!.id, exerciseId: exerciseIdByName.get(lift)!, orderIndex: orderIndex++ })
          .returning();

        const warmups = calculateWarmupSets({
          workingLoadKg: topWeight,
          warmupSetCount: DEFAULT_WARMUP_PERCENTAGES.length,
          warmupPercentages: DEFAULT_WARMUP_PERCENTAGES,
          warmupRepsPerSet: DEFAULT_WARMUP_REPS_PER_SET,
        });

        const rows = [
          ...warmups.map((w, i) => ({
            sessionExerciseId: sessEx!.id,
            setIndex: i + 1,
            setType: 'warmup' as const,
            prescribedReps: w.prescribedReps,
            prescribedLoadKg: n(w.prescribedLoadKg),
            actualWeightKg: n(w.prescribedLoadKg),
            actualReps: w.prescribedReps,
            completed: true,
            completedAt: completed,
          })),
          ...working.map((w, i) => ({
            sessionExerciseId: sessEx!.id,
            setIndex: warmups.length + i + 1,
            setType: 'working' as const,
            prescribedReps: w.reps,
            prescribedLoadKg: n(w.weightKg),
            actualWeightKg: n(w.weightKg),
            actualReps: w.reps,
            actualRpe: n(w.rpe),
            actualVelocityMps: n(w.velocity),
            completed: true,
            completedAt: completed,
          })),
        ];
        await tx.insert(sessionSets).values(rows);
        counts.sets += rows.length;
      }

      // Accessories: RPE only, no velocity.
      for (const acc of plan.accessories) {
        const id = exerciseIdByName.get(acc.name);
        if (!id) continue;
        const weightKg = roundToNearestIncrement(acc.baseKg * (1 + 0.05 * (week / WEEKS)) + jitter(1.5), 2.5);
        const [sessEx] = await tx
          .insert(sessionExercises)
          .values({ sessionId: session!.id, exerciseId: id, orderIndex: orderIndex++ })
          .returning();
        const rows = Array.from({ length: acc.sets }, (_, i) => ({
          sessionExerciseId: sessEx!.id,
          setIndex: i + 1,
          setType: 'working' as const,
          prescribedReps: acc.reps,
          prescribedLoadKg: n(weightKg),
          actualWeightKg: n(weightKg),
          actualReps: acc.reps,
          actualRpe: n(acc.rpe + Math.round(jitter(0.5))),
          completed: true,
          completedAt: completed,
        }));
        await tx.insert(sessionSets).values(rows);
        counts.sets += rows.length;
      }
    }

    // ----- Nutrition -----
    await tx.insert(nutritionTargets).values({
      userId,
      effectiveDate: dateStr(daysAgoDate(WEEKS * 7)),
      caloriesTarget: 3000,
      proteinGTarget: n(180),
      carbsGTarget: n(330),
      fatGTarget: n(80),
    });

    const foodIdByName = new Map<string, string>();
    for (const item of FOOD_ITEMS) {
      const [row] = await tx
        .insert(foodItems)
        .values({
          userId,
          name: item.name,
          brand: item.brand,
          servingSize: n(item.servingSize)!,
          servingUnit: item.servingUnit,
          calories: n(item.calories)!,
          proteinG: n(item.proteinG)!,
          carbsG: n(item.carbsG)!,
          fatG: n(item.fatG)!,
        })
        .returning();
      foodIdByName.set(item.name, row!.id);
    }

    for (let d = 0; d < NUTRITION_LOG_DAYS; d++) {
      const logDate = dateStr(daysAgoDate(d));
      const loggedAt = daysAgoDate(d);
      for (const [foodName, mealType, servings] of DAILY_MEALS) {
        await tx.insert(foodLogEntries).values({
          userId,
          foodItemId: foodIdByName.get(foodName)!,
          logDate,
          mealType,
          servings: n(Math.round((servings * (1 + jitter(0.1))) * 100) / 100)!,
          loggedAt,
        });
        counts.foodLogs++;
      }
    }

    // ----- Sleep -----
    for (let d = 0; d < SLEEP_LOG_DAYS; d++) {
      const hours = Math.round((7.5 + jitter(1.0)) * 10) / 10;
      await tx.insert(sleepLogs).values({
        userId,
        logDate: dateStr(daysAgoDate(d)),
        hoursSlept: n(hours)!,
        hoursInBed: n(Math.round((hours + 0.5) * 10) / 10),
        qualityRating: 3 + Math.floor(rand() * 3),
      });
      counts.sleepLogs++;
    }

    // ----- Supplements -----
    for (let i = 0; i < SUPPLEMENTS.length; i++) {
      const supp = SUPPLEMENTS[i]!;
      const [row] = await tx
        .insert(supplements)
        .values({ userId, name: supp.name, dosage: supp.dosage, isActive: true, sortOrder: i })
        .returning();
      for (let d = 0; d < SUPPLEMENT_LOG_DAYS; d++) {
        await tx.insert(supplementLogs).values({
          supplementId: row!.id,
          logDate: dateStr(daysAgoDate(d)),
          taken: rand() > 0.1,
        });
        counts.supplementLogs++;
      }
    }
  });

  console.log('Seeded test user:');
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`  1RM:      Squat ${CURRENT_1RM.Squat} / Bench ${CURRENT_1RM['Bench Press']} / Deadlift ${CURRENT_1RM.Deadlift} kg`);
  console.log(`  sessions: ${counts.sessions}, sets: ${counts.sets}, foodLogs: ${counts.foodLogs}, sleepLogs: ${counts.sleepLogs}, supplementLogs: ${counts.supplementLogs}`);
  await sql.end();
}

main().catch((err) => {
  console.error('Test-user seed failed:', err);
  process.exit(1);
});
