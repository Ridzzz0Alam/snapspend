/** Date / time input helpers. Display format is DD/MM/YYYY (SPEC §1); storage is ISO (D20). */

const pad = (n: number) => String(n).padStart(2, '0');

function validIso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * `DD/MM/YYYY` (also `.` or `-` separators) or ISO `YYYY-MM-DD` / Hungarian `YYYY.MM.DD.` → ISO.
 * Returns null for anything that isn't a real calendar date.
 */
export function parseDisplayDate(input: string): string | null {
  const s = input.trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return validIso(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{4})[-.](\d{1,2})[-.](\d{1,2})\.?$/.exec(s);
  if (m) return validIso(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

/** `H:MM`, `HH:MM` or `HH.MM` → `HH:MM`; blank → null. */
export function parseTime(input: string): { ok: true; value: string | null } | { ok: false } {
  const s = input.trim();
  if (!s) return { ok: true, value: null };
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(s);
  if (!m) return { ok: false };
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return { ok: false };
  return { ok: true, value: `${pad(h)}:${pad(min)}` };
}

/** The device-local calendar date as ISO (D20). */
export function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
