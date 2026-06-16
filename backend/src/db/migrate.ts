import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './client';

async function main() {
  await migrate(db, { migrationsFolder: './drizzle' });
  await sql.end();
  console.log('Migrations applied.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
