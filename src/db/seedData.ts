/**
 * Sample receipts = the SPEC §6 golden-test data (with categories). Used by the dev-only seed
 * (src/db/seed.ts) and by the golden tests, so both always describe the same receipts.
 */
import type { ItemInput, ReceiptInput } from './repository';

const pcs = (
  nameEn: string,
  sizeLabel: string | null,
  quantity: number,
  unitPrice: number,
  lineTotal: number,
  category: string,
): ItemInput => ({ nameEn, sizeLabel, quantity, unit: 'pcs', unitPrice, lineTotal, category });

const kg = (
  nameEn: string,
  sizeLabel: string | null,
  quantity: number,
  unitPrice: number,
  lineTotal: number,
  category: string,
): ItemInput => ({ nameEn, sizeLabel, quantity, unit: 'kg', unitPrice, lineTotal, category });

/** Golden test 1: 02/11/2026, ALDI + SPAR (Interspar). */
export const golden1Receipts: ReceiptInput[] = [
  {
    kind: 'scanned',
    store: 'ALDI',
    date: '2026-11-02',
    time: '10:15',
    printedTotal: 847,
    items: [
      pcs('Sauce beans', '420g', 1, 239, 239, 'Pantry'),
      pcs('Sauce beans', '420g', 1, 239, 239, 'Pantry'),
      pcs('Toast bread', '500g', 1, 369, 369, 'Bakery'),
    ],
    adjustments: [],
  },
  {
    kind: 'scanned',
    store: 'SPAR (Interspar)',
    date: '2026-11-02',
    time: '17:40',
    printedTotal: 3894,
    items: [
      pcs('Corn snack', '100g', 2, 155, 310, 'Snacks & Sweets'),
      pcs('Peeled tomatoes', '400g', 1, 259, 259, 'Pantry'),
      kg('Banana', null, 1.294, 449, 581, 'Fruit & Veg'),
      pcs('Metal scourers', '3pcs', 1, 299, 299, 'Household & Cleaning'),
      pcs('Red onion', '1kg', 2, 277, 554, 'Fruit & Veg'),
      pcs('Milk chocolate bar', '100g', 2, 459, 918, 'Snacks & Sweets'),
      pcs('UHT milk 2.8%', '1L', 2, 285, 570, 'Dairy & Eggs'),
      pcs('Natural yogurt 3%', '175g', 1, 85, 85, 'Dairy & Eggs'),
      pcs('Chocolate donut', null, 2, 159, 318, 'Bakery'),
    ],
    adjustments: [],
  },
];

/** Golden test 2: total-only + manual across two days (deliberately out of order). */
export const golden2Receipts: ReceiptInput[] = [
  {
    kind: 'manual',
    store: 'Yettel Recharge',
    date: '2026-11-13',
    time: null,
    printedTotal: 3000,
    items: [],
    adjustments: [],
  },
  {
    kind: 'total_only',
    store: 'Kashmiri Bazar',
    date: '2026-11-06',
    time: '18:30',
    printedTotal: 6490,
    items: [],
    adjustments: [],
  },
  {
    kind: 'scanned',
    store: 'SPAR',
    date: '2026-11-06',
    time: '09:05',
    printedTotal: 889,
    items: [
      pcs('Sweet corn', '285g', 1, 299, 299, 'Pantry'),
      pcs('Chopped tomatoes', null, 2, 295, 590, 'Pantry'),
    ],
    adjustments: [],
  },
];

/** Golden test 3: TESCO with Clubcard discounts. */
export const golden3Receipts: ReceiptInput[] = [
  {
    kind: 'scanned',
    store: 'TESCO',
    date: '2026-11-07',
    time: '12:00',
    printedTotal: 1366,
    items: [
      pcs('Dates', '200g', 1, 449, 449, 'Snacks & Sweets'),
      pcs('Milka Alpine milk chocolate', '90g', 2, 699, 1398, 'Snacks & Sweets'),
      pcs('Bio bag', null, 1, 19, 19, 'Household & Cleaning'),
    ],
    adjustments: [
      { type: 'discount', label: 'Clubcard discount', amount: 100 },
      { type: 'discount', label: 'Clubcard discount', amount: 400 },
    ],
  },
];

export const seedReceipts: ReceiptInput[] = [
  ...golden1Receipts,
  ...golden2Receipts,
  ...golden3Receipts,
];
