/**
 * Golden-test data from SPEC §6. Also reused by the dev seed script in Phase 2.
 * Expected strings are built with explicit \u escapes so the × (U+00D7) and − (U+2212)
 * characters can't be silently swapped for ASCII by an editor.
 */
import type { LineItem, ReceiptData } from '@/lib/types';

const X = '×';
const M = '−';

const pcs = (
  nameEn: string,
  sizeLabel: string | null,
  quantity: number,
  unitPrice: number,
  lineTotal: number,
): LineItem => ({ nameEn, sizeLabel, quantity, unit: 'pcs', unitPrice, lineTotal });

const kg = (
  nameEn: string,
  sizeLabel: string | null,
  quantity: number,
  unitPrice: number,
  lineTotal: number,
): LineItem => ({ nameEn, sizeLabel, quantity, unit: 'kg', unitPrice, lineTotal });

// ---- Golden test 1 ---------------------------------------------------------

export const golden1Receipts: ReceiptData[] = [
  {
    kind: 'scanned',
    store: 'ALDI',
    date: '2026-11-02',
    time: '10:15',
    printedTotal: 847,
    items: [
      pcs('Sauce beans', '420g', 1, 239, 239),
      pcs('Sauce beans', '420g', 1, 239, 239),
      pcs('Toast bread', '500g', 1, 369, 369),
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
      pcs('Corn snack', '100g', 2, 155, 310),
      pcs('Peeled tomatoes', '400g', 1, 259, 259),
      kg('Banana', null, 1.294, 449, 581),
      pcs('Metal scourers', '3pcs', 1, 299, 299),
      pcs('Red onion', '1kg', 2, 277, 554),
      pcs('Milk chocolate bar', '100g', 2, 459, 918),
      pcs('UHT milk 2.8%', '1L', 2, 285, 570),
      pcs('Natural yogurt 3%', '175g', 1, 85, 85),
      pcs('Chocolate donut', null, 2, 159, 318),
    ],
    adjustments: [],
  },
];

export const golden1Expected = [
  '02/11/2026',
  'ALDI => Sauce beans 420g 239Ft + Sauce beans 420g 239Ft + Toast bread 500g 369Ft = 847 Ft',
  `SPAR (Interspar) => Corn snack 100g 2Db${X}155Ft/Db 310Ft + Peeled tomatoes 400g 259Ft + Banana 1.294Kg${X}449Ft/Kg 581Ft + Metal scourers 3pcs 299Ft + Red onion 1kg 2Db${X}277Ft/Db 554Ft + Milk chocolate bar 100g 2Db${X}459Ft/Db 918Ft + UHT milk 2.8% 1L 2Db${X}285Ft/Db 570Ft + Natural yogurt 3% 175g 85Ft + Chocolate donut 2Db${X}159Ft/Db 318Ft = 3.894 Ft`,
  'TOTAL - 4.741 Ft',
].join('\n');

// ---- Golden test 2 ---------------------------------------------------------

export const golden2Receipts: ReceiptData[] = [
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
    items: [pcs('Sweet corn', '285g', 1, 299, 299), pcs('Chopped tomatoes', null, 2, 295, 590)],
    adjustments: [],
  },
];

export const golden2Expected = [
  '06/11/2026',
  `SPAR => Sweet corn 285g 299Ft + Chopped tomatoes 2Db${X}295Ft/Db 590Ft = 889 Ft`,
  'Kashmiri Bazar => 6.490 Ft',
  'TOTAL - 7.379 Ft',
  '',
  '13/11/2026',
  'Yettel Recharge => 3.000 Ft',
  'TOTAL - 3.000 Ft',
  '',
  'GRAND TOTAL - 10.379 Ft',
].join('\n');

// ---- Golden test 3 ---------------------------------------------------------

export const golden3Receipts: ReceiptData[] = [
  {
    kind: 'scanned',
    store: 'TESCO',
    date: '2026-11-07',
    time: '12:00',
    printedTotal: 1366,
    items: [
      pcs('Dates', '200g', 1, 449, 449),
      pcs('Milka Alpine milk chocolate', '90g', 2, 699, 1398),
      pcs('Bio bag', null, 1, 19, 19),
    ],
    adjustments: [
      { type: 'discount', label: 'Clubcard discount', amount: 100 },
      { type: 'discount', label: 'Clubcard discount', amount: 400 },
    ],
  },
];

export const golden3Expected = [
  '07/11/2026',
  `TESCO => Dates 200g 449Ft + Milka Alpine milk chocolate 90g 2Db${X}699Ft/Db 1.398Ft + Bio bag 19Ft ${M} Clubcard discount 100Ft ${M} Clubcard discount 400Ft = 1.366 Ft`,
  'TOTAL - 1.366 Ft',
].join('\n');
