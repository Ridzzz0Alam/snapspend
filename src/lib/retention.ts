/**
 * Receipt photo retention (D46, D74): "Delete receipt images older than Never / 6 months / 1 year".
 * Age is by the receipt's date. Only photos go; receipts and items stay.
 */

export const RETENTION_OPTIONS = ['never', '6m', '1y'] as const;
export type Retention = (typeof RETENTION_OPTIONS)[number];

export const DEFAULT_RETENTION: Retention = 'never';

export const RETENTION_LABELS: Record<Retention, string> = {
  never: 'Never',
  '6m': '6 months',
  '1y': '1 year',
};

const MONTHS: Record<Exclude<Retention, 'never'>, number> = { '6m': 6, '1y': 12 };

const pad = (n: number) => String(n).padStart(2, '0');

/** Unknown or missing stored values fall back to Never, so nothing is deleted by surprise. */
export function parseRetention(value: string | null | undefined): Retention {
  return (RETENTION_OPTIONS as readonly string[]).includes(value ?? '')
    ? (value as Retention)
    : DEFAULT_RETENTION;
}

/**
 * The ISO date before which photos are deleted (receipts dated strictly earlier), or null for
 * Never. `today` is an ISO date. Months are calendar months, clamped to the month's last day:
 * 6 months before 31/08/2026 is 28/02/2026.
 */
export function retentionCutoff(option: Retention, today: string): string | null {
  if (option === 'never') return null;
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) - MONTHS[option];
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}

/** True when switching from `from` to `to` can delete photos that are kept now. */
export function isStricter(from: Retention, to: Retention): boolean {
  const months = (r: Retention) => (r === 'never' ? Infinity : MONTHS[r]);
  return months(to) < months(from);
}

/** `1.4 MB`, `820 KB`: photo storage shown in Settings. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
