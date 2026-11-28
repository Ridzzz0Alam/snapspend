/**
 * Money helpers. All money in Snap Spend is integer forints (HUF).
 */

/**
 * Daily Log number style (SPEC §6, D57): `,` thousands separators, no decimals,
 * no separator below 1000: `847`, `3,894`, `10,076`, `-1,250`.
 * Non-integer input is rounded to the nearest forint. Use only for the Daily Log text.
 */
export function formatAmount(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * App screen style (DECISIONS D31): `,` thousands separators, two decimals, ` Ft` suffix:
 * `847.00 Ft`, `3,894.00 Ft`, `-1,250.00 Ft`. Non-integer input is rounded to the nearest forint.
 */
export function formatFt(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${digits}.00 Ft`;
}

/**
 * Parses a user- or receipt-typed HUF amount into integer forints. Returns `null` if unreadable.
 *
 * Accepts Hungarian and English styles: `1059`, `1 059`, `1.059`, `1,059`, `1059 Ft`, `HUF 1059`,
 * `3,894.00 Ft`, `1.059,50`, `1 059,50`, `-250`. Spaces are always thousands separators.
 * When both `.` and `,` appear, the last one is the decimal separator and the other groups thousands.
 * When only one of them appears, it is a thousands separator if every group after it has exactly
 * three digits (`1.059`, `1,234,567`), otherwise a single one is a decimal point (`12.5`, `1059,4`).
 * Decimals are rounded to whole forints.
 */
export function parseHuf(input: string): number | null {
  let s = input
    .replace(/[\s  ]+/g, '')
    .replace(/ft\.?$/i, '')
    .replace(/^huf/i, '')
    .replace(/huf$/i, '')
    .replace(/−/g, '-');

  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  }
  if (s === '') return null;

  let intPart = s;
  let decPart = '';

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    const decIdx = Math.max(lastDot, lastComma);
    const groupSep = lastDot > lastComma ? ',' : '.';
    intPart = s.slice(0, decIdx);
    decPart = s.slice(decIdx + 1);
    if (!/^\d+$/.test(decPart) || !isGrouped(intPart, groupSep)) return null;
    intPart = intPart.split(groupSep).join('');
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    const parts = s.split(sep);
    if (parts.length > 1 && isGrouped(s, sep)) {
      intPart = parts.join('');
    } else if (parts.length === 2 && /^\d+$/.test(parts[0]!) && /^\d+$/.test(parts[1]!)) {
      [intPart, decPart] = parts as [string, string];
    } else {
      return null;
    }
  }

  if (!/^\d+$/.test(intPart)) return null;

  const value = Number(decPart ? `${intPart}.${decPart}` : intPart);
  const result = sign * Math.round(value);
  return Object.is(result, -0) ? 0 : result;
}

/** `1`, `1.059`, `1.234.567` style grouping: 1–3 leading digits, then groups of exactly 3. */
function isGrouped(s: string, sep: '.' | ','): boolean {
  const [head, ...rest] = s.split(sep);
  return /^\d{1,3}$/.test(head ?? '') && rest.every((g) => /^\d{3}$/.test(g));
}
