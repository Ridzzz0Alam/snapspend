/**
 * Export / import files on the device (Phase 8): Excel export (D71) and JSON backup (D72).
 * Files are written to the cache directory and handed to the Android share sheet, so the user
 * can open them in Sheets / Excel or save them to Drive, Files, email…
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db } from '@/db/client';
import { buildBackup, mergeBackup, parseBackup, type MergeResult } from '@/db/backup';
import { listByDateRange } from '@/db/repository';
import { isoFromDate } from '@/lib/dates';
import { buildExportSheets, exportFileName } from '@/lib/exportWorkbook';
import { buildXlsx } from '@/lib/xlsx';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type FileResult = { ok: true; message: string } | { ok: false; message: string };

function writeCacheFile(name: string, content: string | Uint8Array): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  return file;
}

async function share(file: File, mimeType: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

/** All live receipts → .xlsx (Items + Receipts sheets) → share sheet. */
export async function exportExcel(): Promise<FileResult> {
  try {
    const all = listByDateRange(db, '0000-01-01', '9999-12-31');
    if (all.length === 0) return { ok: false, message: 'Nothing to export yet.' };
    const bytes = buildXlsx(buildExportSheets(all));
    const file = writeCacheFile(exportFileName(isoFromDate(new Date()), 'xlsx'), bytes);
    await share(file, XLSX_MIME, 'Export Snap Spend to Excel');
    const itemCount = all.reduce((n, r) => n + r.items.length, 0);
    return { ok: true, message: `Exported ${all.length} receipts and ${itemCount} items.` };
  } catch (e) {
    return { ok: false, message: `Export failed. ${e instanceof Error ? e.message : ''}`.trim() };
  }
}

/** Full JSON backup (incl. deleted receipts, without photos) → share sheet. */
export async function exportBackup(): Promise<FileResult> {
  try {
    const backup = buildBackup(db);
    const file = writeCacheFile(
      exportFileName(isoFromDate(new Date()), 'json'),
      JSON.stringify(backup),
    );
    await share(file, 'application/json', 'Save Snap Spend backup');
    return { ok: true, message: `Backup of ${backup.receipts.length} receipts ready.` };
  } catch (e) {
    return { ok: false, message: `Backup failed. ${e instanceof Error ? e.message : ''}`.trim() };
  }
}

/** Pick a backup file and merge it in (D44). `null` when the user cancels the picker. */
export async function importBackup(): Promise<(FileResult & { merge?: MergeResult }) | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
  if (picked.canceled) return null;
  try {
    const parsed = parseBackup(await picked.result.text());
    if (!parsed.ok) return { ok: false, message: parsed.error };
    const merge = mergeBackup(db, parsed.backup);
    return {
      ok: true,
      merge,
      message: `Imported: ${merge.added} added, ${merge.updated} updated, ${merge.unchanged} already up to date.`,
    };
  } catch (e) {
    return { ok: false, message: `Import failed. ${e instanceof Error ? e.message : ''}`.trim() };
  }
}
