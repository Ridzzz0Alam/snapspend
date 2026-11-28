/**
 * Receipt image files on the device (D45): compress each page once (long edge ≤ 1600 px, JPEG 0.7),
 * send that copy to Gemini, and on Save keep that same copy in the app's document directory:
 * `<document>/receipts/<receiptId>/page-N.jpg`. Full-size originals are never kept.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { fitLongEdge, JPEG_QUALITY, LONG_EDGE_PX, receiptPageName } from '@/lib/images';
import type { CompressedPage } from '@/lib/scanQueue';

/** Scanner / file paths sometimes come without a scheme. */
export function toFileUri(pathOrUri: string): string {
  return /^[a-z]+:\/\//i.test(pathOrUri) ? pathOrUri : `file://${pathOrUri}`;
}

/** Compresses one page into the cache directory and returns its URI and base64. */
export async function compressPage(sourceUri: string): Promise<CompressedPage> {
  // Decode at most 2× the target so a 50 MP photo never sits in memory at full size.
  let image = await ImageManipulator.manipulate(toFileUri(sourceUri), {
    maxWidth: LONG_EDGE_PX * 2,
    maxHeight: LONG_EDGE_PX * 2,
  }).renderAsync();
  const target = fitLongEdge(image.width, image.height);
  if (target) {
    const resized = await ImageManipulator.manipulate(image).resize(target).renderAsync();
    image.release();
    image = resized;
  }
  const saved = await image.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });
  image.release();
  if (!saved.base64) throw new Error('Image compression returned no data');
  return { uri: saved.uri, base64: saved.base64 };
}

function receiptDir(receiptId: string): Directory {
  return new Directory(Paths.document, 'receipts', receiptId);
}

/** Copies the compressed pages into permanent storage; returns their file URIs in page order. */
export function saveReceiptImages(receiptId: string, pages: readonly CompressedPage[]): string[] {
  const dir = receiptDir(receiptId);
  dir.create({ intermediates: true, idempotent: true });
  return pages.map((page, i) => {
    const dest = new File(dir, receiptPageName(i));
    if (dest.exists) dest.delete();
    new File(page.uri).copySync(dest);
    return dest.uri;
  });
}

/** Removes a receipt's saved images (used when a save fails half-way). Never throws. */
export function deleteReceiptImages(receiptId: string): void {
  try {
    const dir = receiptDir(receiptId);
    if (dir.exists) dir.delete();
  } catch {
    // best effort
  }
}

/** Deletes temporary files (compressed cache copies, scanner output). Never throws. */
export function deleteTempFiles(uris: readonly string[]): void {
  for (const uri of uris) {
    try {
      const f = new File(toFileUri(uri));
      if (f.exists) f.delete();
    } catch {
      // best effort
    }
  }
}
