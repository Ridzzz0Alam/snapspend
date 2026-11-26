/**
 * App database (device only). Tests use an in-memory sql.js database instead; see __tests__/helpers/testDb.ts.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'snapspend.db';

const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
// SQLite leaves foreign keys off by default; ON DELETE CASCADE needs them on.
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
