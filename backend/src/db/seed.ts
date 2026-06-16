import { sql, db } from './client';
import { exercises } from './schema/index';
import type { ExerciseCategory } from '@glob/shared';

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

async function main() {
  for (const exercise of SYSTEM_EXERCISES) {
    await db
      .insert(exercises)
      .values({ ...exercise, userId: null, isSystem: true })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${SYSTEM_EXERCISES.length} system exercises.`);
  await sql.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
