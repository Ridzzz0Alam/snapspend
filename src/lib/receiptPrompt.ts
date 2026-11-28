/**
 * The receipt-reading contract from SPEC §5: prompt text and response schema. Kept separate from
 * the Gemini client so another provider can reuse them later (DECISIONS O3).
 * Both must match docs/SPEC.md §5 exactly; __tests__/receiptPrompt.test.ts checks this.
 */
import { DEFAULT_CATEGORIES } from './categories';

export const RECEIPT_PROMPT_TEMPLATE = `You are reading a shop receipt, most likely from Hungary (Hungarian language, HUF currency).
Extract every purchased line item. Rules:
- nameEn: short natural English product name (translate Hungarian; keep brand names such as Milka, Nescafé).
- nameOriginal: the text exactly as printed.
- sizeLabel: package size if printed or implied (e.g. "100g", "1L", "450g", "3pcs"), else null.
- quantity + unit: "2 db x 159" → quantity 2, unit "pcs", unitPrice 159. Weighed goods "0,792 kg x 1059 Ft/kg" → quantity 0.792, unit "kg", unitPrice 1059.
- All money values are integers in forints. Hungarian receipts use "." or space as thousands separator and "," as decimal separator.
- lineTotal is the amount charged for that line before receipt-level discounts.
- Put loyalty discounts (Tesco Clubcard, "kedvezmény"), coupons and loyalty-point payments (SPAR Repont) in adjustments, not in items. Service charges and bottle deposits are adjustments of type "charge".
- bags (bio bag, paper bag, "zacskó") are items in category "Household & Cleaning".
- category: one of the provided list.
- printedTotal: the final amount the customer paid ("ÖSSZESEN", "Fizetendő", card amount).
- If the slip is only a card terminal slip with no items, return items: [] and kind "total_only".
- date as YYYY-MM-DD, time as HH:MM if present. cardLast4 if a masked card number is printed.
- confidence: 0..1 overall; list unreadable or guessed fields in notes.
Categories: {CATEGORY_LIST}`;

/** Gemini responseSchema (OpenAPI subset), exactly as in SPEC §5. */
export const RECEIPT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: {
      type: 'STRING',
      enum: ['scanned', 'total_only'],
    },
    store: {
      type: 'STRING',
    },
    date: {
      type: 'STRING',
    },
    time: {
      type: 'STRING',
      nullable: true,
    },
    cardLast4: {
      type: 'STRING',
      nullable: true,
    },
    paymentMethod: {
      type: 'STRING',
      nullable: true,
    },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nameEn: {
            type: 'STRING',
          },
          nameOriginal: {
            type: 'STRING',
            nullable: true,
          },
          sizeLabel: {
            type: 'STRING',
            nullable: true,
          },
          quantity: {
            type: 'NUMBER',
          },
          unit: {
            type: 'STRING',
            enum: ['pcs', 'kg'],
          },
          unitPrice: {
            type: 'INTEGER',
            nullable: true,
          },
          lineTotal: {
            type: 'INTEGER',
          },
          category: {
            type: 'STRING',
          },
        },
        required: ['nameEn', 'quantity', 'unit', 'lineTotal', 'category'],
      },
    },
    adjustments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: {
            type: 'STRING',
            enum: ['discount', 'charge', 'points'],
          },
          label: {
            type: 'STRING',
          },
          amount: {
            type: 'INTEGER',
          },
          appliesTo: {
            type: 'STRING',
            nullable: true,
          },
        },
        required: ['type', 'label', 'amount'],
      },
    },
    printedTotal: {
      type: 'INTEGER',
    },
    confidence: {
      type: 'NUMBER',
    },
    notes: {
      type: 'ARRAY',
      items: {
        type: 'STRING',
      },
    },
  },
  required: ['kind', 'store', 'date', 'items', 'adjustments', 'printedTotal'],
} as const;

/** The prompt with `{CATEGORY_LIST}` filled in (comma separated). */
export function buildReceiptPrompt(categories: readonly string[] = DEFAULT_CATEGORIES): string {
  return RECEIPT_PROMPT_TEMPLATE.replace('{CATEGORY_LIST}', categories.join(', '));
}
