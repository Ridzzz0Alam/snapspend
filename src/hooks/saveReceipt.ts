/**
 * Saves a reviewed receipt (Phase 4): copy the compressed pages into app storage under the new
 * receipt id, then insert the receipt, items and adjustments in one transaction. If the insert
 * fails, the copied images are removed again, so nothing is left half-saved.
 */
import { db } from '@/db/client';
import { newId } from '@/db/ids';
import { createReceiptWithItems } from '@/db/repository';
import type { DraftInput } from '@/lib/reviewDraft';
import type { CompressedPage } from '@/lib/scanQueue';
import { deleteReceiptImages, saveReceiptImages } from '@/media/receiptImages';

export type SaveResult = { ok: true; id: string } | { ok: false; message: string };

export function saveReceipt(input: DraftInput, pages: readonly CompressedPage[] = []): SaveResult {
  const id = newId();
  try {
    const imagePaths = pages.length ? saveReceiptImages(id, pages) : null;
    createReceiptWithItems(db, { ...input, imagePaths }, { receiptId: id });
    return { ok: true, id };
  } catch (e) {
    deleteReceiptImages(id);
    return {
      ok: false,
      message: `Could not save the receipt. Nothing was saved.${
        e instanceof Error ? `\n(${e.message})` : ''
      }`,
    };
  }
}
