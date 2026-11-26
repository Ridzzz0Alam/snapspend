import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous drizzle SQLite database with our schema: expo-sqlite on the device,
 * sql.js in unit tests. Repository functions take this so they can be tested in Node.
 */
export type AppDatabase = BaseSQLiteDatabase<'sync', any, typeof schema>;
