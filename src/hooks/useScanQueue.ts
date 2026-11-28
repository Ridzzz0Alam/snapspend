/**
 * The scan queue at app level: state lives outside React so it keeps going while the user moves
 * between screens. One job at a time: compress its pages, then read them with Gemini.
 * Pure transitions are in src/lib/scanQueue.ts.
 */
import { randomUUID } from 'expo-crypto';
import { useSyncExternalStore } from 'react';

import { db } from '@/db/client';
import { listCategories } from '@/db/lists';
import { extractReceipt } from '@/lib/gemini';
import {
  addJobs,
  initialQueue,
  nextJob,
  queueReducer,
  type QueueAction,
  type QueueState,
  type ScanJob,
} from '@/lib/scanQueue';
import { compressPage, deleteTempFiles } from '@/media/receiptImages';

import { getGeminiConfig } from './useGeminiSettings';

let state: QueueState = initialQueue;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function dispatch(action: QueueAction) {
  state = queueReducer(state, action);
  emit();
  void pump();
}

let pumping = false;

/** Runs waiting jobs one after another until none is left. */
async function pump(): Promise<void> {
  if (pumping) return;
  const job = nextJob(state);
  if (!job) return;
  pumping = true;
  try {
    await step(job);
  } finally {
    pumping = false;
  }
  void pump();
}

async function step(job: ScanJob): Promise<void> {
  if (job.status === 'queued') {
    dispatch({ type: 'compressing', id: job.id });
    try {
      const pages = [];
      for (const uri of job.originalUris) pages.push(await compressPage(uri));
      // Scanner output is our own temp file; gallery photos belong to the user and stay.
      if (job.source === 'scanner') deleteTempFiles(job.originalUris);
      dispatch({ type: 'compressed', id: job.id, pages });
    } catch (e) {
      dispatch({
        type: 'failed',
        id: job.id,
        error: {
          kind: 'image',
          message: 'This photo could not be opened or compressed.',
          detail: e instanceof Error ? e.message : undefined,
        },
      });
    }
    return;
  }

  // status 'compressed' → read with Gemini
  dispatch({ type: 'reading', id: job.id });
  const config = await getGeminiConfig();
  const current = state.jobs.find((j) => j.id === job.id);
  if (!current) return; // discarded meanwhile
  const result = await extractReceipt({
    apiKey: config.apiKey ?? '',
    model: config.model,
    images: current.pages.map((p) => p.base64),
    categories: listCategories(db),
  });
  if (!state.jobs.some((j) => j.id === job.id)) return; // discarded while reading
  if (result.ok) dispatch({ type: 'read', id: job.id, extracted: result.value });
  else dispatch({ type: 'failed', id: job.id, error: result.error });
}

// ---- Public API ------------------------------------------------------------------

/** Adds receipts to the queue: each inner array is one receipt's pages. */
export function enqueueReceipts(pageSets: string[][], source: ScanJob['source']): void {
  state = addJobs(state, pageSets, source, { newId: randomUUID, now: Date.now });
  emit();
  void pump();
}

/** Failed → try again from the step that failed; Ready → read with Gemini again. */
export function retryJob(id: string): void {
  dispatch({ type: 'retry', id });
}

/** Drops a job and deletes its temporary files (cancel / discard / after saving). */
export function removeJob(id: string, { keepFiles = false }: { keepFiles?: boolean } = {}): void {
  const job = state.jobs.find((j) => j.id === id);
  if (!job) return;
  if (!keepFiles) {
    deleteTempFiles(job.pages.map((p) => p.uri));
    if (job.source === 'scanner') deleteTempFiles(job.originalUris);
  }
  dispatch({ type: 'remove', id });
}

export function getJob(id: string): ScanJob | undefined {
  return state.jobs.find((j) => j.id === id);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScanQueue(): QueueState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useScanJob(id: string | undefined): ScanJob | undefined {
  return useSyncExternalStore(subscribe, () =>
    id ? state.jobs.find((j) => j.id === id) : undefined,
  );
}
