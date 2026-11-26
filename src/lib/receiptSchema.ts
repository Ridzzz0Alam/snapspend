/**
 * zod mirror of the Gemini responseSchema (SPEC §5). Every Gemini response goes through
 * `validateReceipt` before it touches the database.
 */
import { z } from 'zod';

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date as YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'Not a real calendar date');

/** `HH:MM`, also accepting `HH:MM:SS` (seconds dropped). Missing → null. */
const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Expected time as HH:MM')
  .transform((s) => s.slice(0, 5))
  .nullish()
  .transform((v) => v ?? null);

/** Keeps the last four digits of whatever masked number Gemini returns (`****1234` → `1234`). */
const cardLast4 = z
  .string()
  .nullish()
  .transform((v) => {
    const digits = (v ?? '').replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : null;
  });

const optionalText = z
  .string()
  .nullish()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : null;
  });

const forints = z.number().int('Money must be whole forints');

export const lineItemSchema = z.object({
  nameEn: z.string().trim().min(1, 'Item name is empty'),
  nameOriginal: optionalText,
  sizeLabel: optionalText,
  quantity: z.number().positive('Quantity must be > 0'),
  unit: z.enum(['pcs', 'kg']),
  unitPrice: forints
    .nonnegative()
    .nullish()
    .transform((v) => v ?? null),
  lineTotal: forints,
  category: z.string().trim(),
});

export const adjustmentSchema = z.object({
  type: z.enum(['discount', 'charge', 'points']),
  label: z.string().trim().min(1, 'Adjustment label is empty'),
  amount: forints.nonnegative('Adjustment amount must be positive; sign comes from type'),
  appliesTo: optionalText,
});

export const geminiReceiptSchema = z.object({
  kind: z.enum(['scanned', 'total_only']),
  store: z.string().trim().min(1, 'Store name is empty'),
  date: isoDate,
  time,
  cardLast4,
  paymentMethod: optionalText,
  items: z.array(lineItemSchema),
  adjustments: z.array(adjustmentSchema),
  printedTotal: forints.nonnegative(),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .nullish()
    .transform((v) => v ?? null),
  notes: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
});

export type GeminiReceipt = z.output<typeof geminiReceiptSchema>;
export type GeminiLineItem = z.output<typeof lineItemSchema>;
export type GeminiAdjustment = z.output<typeof adjustmentSchema>;

export type ValidationResult =
  { ok: true; data: GeminiReceipt } | { ok: false; error: string; issues: string[] };

/**
 * Validates a Gemini response (already-parsed object, or the raw JSON text). Never throws.
 */
export function validateReceipt(input: unknown): ValidationResult {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      return { ok: false, error: 'Gemini returned text that is not valid JSON.', issues: [] };
    }
  }

  const result = geminiReceiptSchema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };

  const issues = result.error.issues.map((i) => {
    const where = i.path.length ? i.path.join('.') : '(root)';
    return `${where}: ${i.message}`;
  });
  return { ok: false, error: "Gemini's answer didn't match the receipt format.", issues };
}
