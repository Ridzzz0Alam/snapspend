import { randomUUID } from 'expo-crypto';

/** UUID v4 for primary keys (DECISIONS D21). */
export function newId(): string {
  return randomUUID();
}
