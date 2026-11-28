import type { GeminiError } from '@/lib/gemini';
import {
  addJobs,
  initialQueue,
  nextJob,
  queueReducer,
  type QueueState,
  type ScanJob,
} from '@/lib/scanQueue';

let n = 0;
const ids = () => `job-${++n}`;
beforeEach(() => {
  n = 0;
});

const err: GeminiError = { kind: 'server', message: 'Gemini had a server problem.' };
const extracted = { receipt: { store: 'SPAR' }, rawJson: '{}' } as unknown as NonNullable<
  ScanJob['extracted']
>;

function withJobs(...pageSets: string[][]): QueueState {
  return addJobs(initialQueue, pageSets, 'gallery', { newId: ids, now: () => 1000 });
}

describe('addJobs', () => {
  it('adds one queued job per page set (scanner: one job with all pages)', () => {
    const s = addJobs(initialQueue, [['a.jpg', 'b.jpg']], 'scanner', {
      newId: ids,
      now: () => 5,
    });
    expect(s.jobs).toEqual([
      {
        id: 'job-1',
        source: 'scanner',
        originalUris: ['a.jpg', 'b.jpg'],
        pages: [],
        status: 'queued',
        createdAt: 5,
      },
    ]);
  });

  it('gallery batch: one job per photo, in order', () => {
    const s = withJobs(['1.jpg'], ['2.jpg'], ['3.jpg']);
    expect(s.jobs.map((j) => [j.id, j.originalUris[0]])).toEqual([
      ['job-1', '1.jpg'],
      ['job-2', '2.jpg'],
      ['job-3', '3.jpg'],
    ]);
  });

  it('ignores empty page sets', () => {
    expect(withJobs([], ['x.jpg']).jobs).toHaveLength(1);
  });
});

describe('nextJob', () => {
  it('picks the oldest job that needs work, one at a time', () => {
    let s = withJobs(['1.jpg'], ['2.jpg']);
    expect(nextJob(s)?.id).toBe('job-1');
    s = queueReducer(s, { type: 'compressing', id: 'job-1' });
    expect(nextJob(s)).toBeNull(); // job-1 is busy
    s = queueReducer(s, { type: 'compressed', id: 'job-1', pages: [{ uri: 'c1', base64: 'b1' }] });
    expect(nextJob(s)?.id).toBe('job-1'); // now needs reading
    s = queueReducer(s, { type: 'reading', id: 'job-1' });
    expect(nextJob(s)).toBeNull();
    s = queueReducer(s, { type: 'read', id: 'job-1', extracted });
    expect(nextJob(s)?.id).toBe('job-2');
  });
});

describe('queueReducer', () => {
  it('records a failure and lets the job be retried from the right step', () => {
    let s = withJobs(['1.jpg']);
    s = queueReducer(s, { type: 'compressing', id: 'job-1' });
    s = queueReducer(s, { type: 'compressed', id: 'job-1', pages: [{ uri: 'c1', base64: 'b1' }] });
    s = queueReducer(s, { type: 'reading', id: 'job-1' });
    s = queueReducer(s, { type: 'failed', id: 'job-1', error: err });
    expect(s.jobs[0]).toMatchObject({ status: 'failed', error: err });
    expect(nextJob(s)).toBeNull(); // failures wait for the user

    s = queueReducer(s, { type: 'retry', id: 'job-1' });
    expect(s.jobs[0]).toMatchObject({ status: 'compressed', error: undefined });
    expect(s.jobs[0]!.pages).toHaveLength(1); // no need to compress again
  });

  it('retry after a compression failure starts over', () => {
    let s = withJobs(['1.jpg']);
    s = queueReducer(s, { type: 'compressing', id: 'job-1' });
    s = queueReducer(s, { type: 'failed', id: 'job-1', error: err });
    s = queueReducer(s, { type: 'retry', id: 'job-1' });
    expect(s.jobs[0]!.status).toBe('queued');
  });

  it('retry on a ready job re-reads it (Review → "Retry with Gemini")', () => {
    let s = withJobs(['1.jpg']);
    s = queueReducer(s, { type: 'compressed', id: 'job-1', pages: [{ uri: 'c1', base64: 'b1' }] });
    s = queueReducer(s, { type: 'read', id: 'job-1', extracted });
    s = queueReducer(s, { type: 'retry', id: 'job-1' });
    expect(s.jobs[0]).toMatchObject({ status: 'compressed', extracted: undefined });
  });

  it('removes a job', () => {
    let s = withJobs(['1.jpg'], ['2.jpg']);
    s = queueReducer(s, { type: 'remove', id: 'job-1' });
    expect(s.jobs.map((j) => j.id)).toEqual(['job-2']);
  });

  it('ignores actions for unknown jobs', () => {
    const s = withJobs(['1.jpg']);
    expect(queueReducer(s, { type: 'reading', id: 'nope' })).toBe(s);
  });
});
