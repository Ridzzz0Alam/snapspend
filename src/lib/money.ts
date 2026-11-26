/**
 * Money helpers. All money in Snap Spend is integer forints (HUF).
 */

/**
 * Formats an integer forint amount with `.` thousands separators (Hungarian style),
 * no separator below 1000: `847`, `3.894`, `10.076`, `-1.250`.
 * Non-integer input is rounded to the nearest forint.
 */
export function formatAmount(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formats an integer forint amount for display: `3.894 Ft`. */
export function formatFt(n: number): string {
  return `${formatAmount(n)} Ft`;
}

/**
 * Parses a user- or receipt-typed HUF amount into integer forints.
 *
 * Accepts `1059`, `1 059`, `1.059`, `1059 Ft`, `1.059 Ft`, `1 059,50` (rounded), `-250`, `HUF 1059`.
 * Spaces (including no-break spaces) and `.` groups of exactly three digits are thousands separators;
 * `,` is the decimal separator. A single `.` not followed by exactly three digits is treated as a
 * decimal point (`12.5`). Returns `null` if the string is not a recognisable amount.
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

  const commaIdx = s.indexOf(',');
  if (commaIdx !== -1) {
    intPart = s.slice(0, commaIdx);
    decPart = s.slice(commaIdx + 1);
    if (!/^\d+$/.test(decPart)) return null;
  }

  if (intPart.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(intPart)) {
      intPart = intPart.replace(/\./g, '');
    } else if (decPart === '' && /^\d+\.\d+$/.test(intPart)) {
      [intPart, decPart] = intPart.split('.') as [string, string];
    } else {
      return null;
    }
  }

  if (!/^\d+$/.test(intPart)) return null;

  const value = Number(decPart ? `${intPart}.${decPart}` : intPart);
  const result = sign * Math.round(value);
  return Object.is(result, -0) ? 0 : result;
}
