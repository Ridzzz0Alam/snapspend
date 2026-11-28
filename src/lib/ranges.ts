/** Date ranges for the Daily Log (SPEC §2.4). ISO `YYYY-MM-DD` in, out; all calendar maths in UTC. */
import { formatLogDate } from './format';

export interface DateRange {
  /** Inclusive, ISO. */
  from: string;
  /** Inclusive, ISO. */
  to: string;
}

export type RangePreset = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth';

export const RANGE_PRESETS: readonly { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
];

const pad = (n: number) => String(n).padStart(2, '0');

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/**
 * Preset ranges relative to `today` (ISO, device-local date). Current periods end today;
 * weeks start on Monday (D62).
 */
export function presetRange(preset: RangePreset, today: string): DateRange {
  const t = toUtc(today);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'thisWeek': {
      const sinceMonday = (t.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
      return { from: addDays(today, -sinceMonday), to: today };
    }
    case 'thisMonth':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'lastMonth': {
      const firstThis = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
      const lastPrev = new Date(firstThis.getTime() - 86_400_000);
      return { from: `${fromUtc(lastPrev).slice(0, 7)}-01`, to: fromUtc(lastPrev) };
    }
  }
}

/** Puts `from` before `to` (a custom range picked backwards still works). */
export function normalizeRange(r: DateRange): DateRange {
  return r.from <= r.to ? r : { from: r.to, to: r.from };
}

/** SPEC §2.4: "Include GRAND TOTAL" is on by default when the range has more than one day. */
export function defaultGrandTotal(r: DateRange): boolean {
  return r.from !== r.to;
}

export function formatRange(r: DateRange): string {
  return r.from === r.to
    ? formatLogDate(r.from)
    : `${formatLogDate(r.from)} – ${formatLogDate(r.to)}`;
}
