/**
 * Scan / import queue (SPEC §2.2). Pure state; src/hooks/useScanQueue.ts runs the steps.
 * Each job is one receipt (the scanner gives all its pages; a gallery batch gives one job per photo).
 * Jobs are processed one at a time, oldest first: compress → read with Gemini → ready for Review.
 */
import type { ExtractedReceipt, GeminiError, GeminiErrorKind } from './gemini';

export type JobStatus = 'queued' | 'compressing' | 'compressed' | 'reading' | 'ready' | 'failed';

export interface CompressedPage {
  /** Compressed JPEG in the cache directory (moved to app storage on Save). */
  uri: string;
  base64: string;
}

/** A Gemini error, or `image` when a photo couldn't be read or compressed on the phone. */
export type JobError = Omit<GeminiError, 'kind'> & { kind: GeminiErrorKind | 'image' };

export interface ScanJob {
  id: string;
  source: 'scanner' | 'gallery';
  /** Originals from the scanner / picker (never kept, D45). */
  originalUris: string[];
  pages: CompressedPage[];
  status: JobStatus;
  extracted?: ExtractedReceipt;
  error?: JobError;
  createdAt: number;
}

export interface QueueState {
  jobs: ScanJob[];
}

export const initialQueue: QueueState = { jobs: [] };

export type QueueAction =
  | { type: 'compressing'; id: string }
  | { type: 'compressed'; id: string; pages: CompressedPage[] }
  | { type: 'reading'; id: string }
  | { type: 'read'; id: string; extracted: ExtractedReceipt }
  | { type: 'failed'; id: string; error: JobError }
  | { type: 'retry'; id: string }
  | { type: 'remove'; id: string };

export function addJobs(
  state: QueueState,
  pageSets: readonly (readonly string[])[],
  source: ScanJob['source'],
  { newId, now }: { newId: () => string; now: () => number },
): QueueState {
  const added = pageSets
    .filter((uris) => uris.length > 0)
    .map((uris): ScanJob => ({
      id: newId(),
      source,
      originalUris: [...uris],
      pages: [],
      status: 'queued',
      createdAt: now(),
    }));
  return added.length ? { jobs: [...state.jobs, ...added] } : state;
}

const BUSY: ReadonlySet<JobStatus> = new Set(['compressing', 'reading']);
const NEEDS_WORK: ReadonlySet<JobStatus> = new Set(['queued', 'compressed']);

/** The job to work on next, or null when one is already running or nothing is waiting. */
export function nextJob(state: QueueState): ScanJob | null {
  if (state.jobs.some((j) => BUSY.has(j.status))) return null;
  return state.jobs.find((j) => NEEDS_WORK.has(j.status)) ?? null;
}

function update(state: QueueState, id: string, fn: (job: ScanJob) => ScanJob | null): QueueState {
  const index = state.jobs.findIndex((j) => j.id === id);
  if (index < 0) return state;
  const next = fn(state.jobs[index]!);
  const jobs = [...state.jobs];
  if (next) jobs[index] = next;
  else jobs.splice(index, 1);
  return { jobs };
}

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'compressing':
      return update(state, action.id, (j) => ({ ...j, status: 'compressing', error: undefined }));
    case 'compressed':
      return update(state, action.id, (j) => ({ ...j, status: 'compressed', pages: action.pages }));
    case 'reading':
      return update(state, action.id, (j) => ({ ...j, status: 'reading', error: undefined }));
    case 'read':
      return update(state, action.id, (j) => ({
        ...j,
        status: 'ready',
        extracted: action.extracted,
      }));
    case 'failed':
      return update(state, action.id, (j) => ({ ...j, status: 'failed', error: action.error }));
    case 'retry':
      return update(state, action.id, (j) => ({
        ...j,
        status: j.pages.length ? 'compressed' : 'queued',
        error: undefined,
        extracted: undefined,
      }));
    case 'remove':
      return update(state, action.id, () => null);
  }
}
