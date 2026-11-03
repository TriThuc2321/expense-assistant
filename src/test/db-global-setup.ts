import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export default async function setup() {
  const client = postgres(
    process.env.TEST_DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5433/expense_test',
    { max: 1, onnotice: () => {} },
  );
  try {
    await migrate(drizzle(client), {
      migrationsFolder: './src/server/db/migrations',
    });
  } finally {
    await client.end();
  }
}
