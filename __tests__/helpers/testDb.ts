/**
 * In-memory SQLite (sql.js / WebAssembly) with the real drizzle-kit migrations applied.
 * Lets repository code run in Jest without the expo-sqlite native module.
 */
import { drizzle } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import * as path from 'path';
import initSqlJs from 'sql.js';

import * as schema from '@/db/schema';
import type { AppDatabase } from '@/db/types';

export async function createTestDb(): Promise<AppDatabase> {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  sqlite.run('PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', '..', 'src', 'db', 'migrations') });
  return db;
}

/** Deterministic ids and clock for assertions. */
export function testDeps(start = 1_000) {
  let n = 0;
  let t = start;
  return {
    newId: () => `id-${String(++n).padStart(3, '0')}`,
    now: () => t++,
  };
}
