import 'server-only';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '@/configs/env';

import * as schema from './schema';

type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | undefined;

export function getDb(): Db {
  cached ??= drizzle(postgres(env().DATABASE_URL), { schema });
  return cached;
}
