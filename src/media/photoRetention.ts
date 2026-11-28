/**
 * Receipt photo retention on the device (D46, D74). The setting is per phone (photos aren't
 * synced), kept in expo-sqlite's key-value store next to the model name (D49). It runs at app
 * start and right after the setting changes.
 */
import { Directory, File, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';

import { db } from '@/db/client';
import { clearImagePaths, listReceiptsWithImagesBefore } from '@/db/repository';
import { isoFromDate } from '@/lib/dates';
import { parseRetention, retentionCutoff, type Retention } from '@/lib/retention';

import { deleteReceiptImages, deleteTempFiles } from './receiptImages';

const RETENTION_KEY = 'image_retention';

export function getRetention(): Retention {
  try {
    return parseRetention(Storage.getItemSync(RETENTION_KEY));
  } catch {
    return parseRetention(null);
  }
}

export function setRetention(option: Retention): void {
  Storage.setItemSync(RETENTION_KEY, option);
}

function sizeOf(entry: File | Directory): number {
  try {
    if (entry instanceof File) return entry.exists ? (entry.size ?? 0) : 0;
    if (!entry.exists) return 0;
    return entry.list().reduce((sum, e) => sum + sizeOf(e), 0);
  } catch {
    return 0;
  }
}

/** Bytes used by saved receipt photos on this phone. */
export function photoStorageBytes(): number {
  return sizeOf(new Directory(Paths.document, 'receipts'));
}

function parsePaths(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function candidates(option: Retention, today: string) {
  const cutoff = retentionCutoff(option, today);
  return { cutoff, rows: cutoff ? listReceiptsWithImagesBefore(db, cutoff) : [] };
}

/** What `option` would delete today: receipts affected, bytes, and the cutoff date. */
export function previewRetention(
  option: Retention,
  today: string = isoFromDate(new Date()),
): { receipts: number; bytes: number; cutoff: string | null } {
  const { cutoff, rows } = candidates(option, today);
  const bytes = rows.reduce(
    (sum, r) => sum + parsePaths(r.imagePaths).reduce((s, p) => s + sizeOf(new File(p)), 0),
    0,
  );
  return { receipts: rows.length, bytes, cutoff };
}

/**
 * Deletes photos of receipts dated before the cutoff and forgets their paths. Receipts and items
 * stay. Returns how many receipts lost their photos. Never throws.
 */
export function applyRetention(
  option: Retention = getRetention(),
  today: string = isoFromDate(new Date()),
): number {
  try {
    const { rows } = candidates(option, today);
    if (rows.length === 0) return 0;
    for (const r of rows) {
      deleteTempFiles(parsePaths(r.imagePaths));
      deleteReceiptImages(r.id);
    }
    clearImagePaths(
      db,
      rows.map((r) => r.id),
    );
    return rows.length;
  } catch {
    return 0;
  }
}
