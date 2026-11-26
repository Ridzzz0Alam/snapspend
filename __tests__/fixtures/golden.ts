/**
 * Expected Daily Log output for the SPEC §6 golden tests. The receipt data lives in
 * src/db/seedData.ts so the dev seed and the tests share it. The × (U+00D7) and − (U+2212)
 * characters are checked by code point in format.test.ts.
 */
export { golden1Receipts, golden2Receipts, golden3Receipts } from '@/db/seedData';

const X = '×';
const M = '−';

// ---- Golden test 1 ---------------------------------------------------------

export const golden1Expected = [
  '02/11/2026',
  'ALDI => Sauce beans 420g 239Ft + Sauce beans 420g 239Ft + Toast bread 500g 369Ft = 847 Ft',
  `SPAR (Interspar) => Corn snack 100g 2Db${X}155Ft/Db 310Ft + Peeled tomatoes 400g 259Ft + Banana 1.294Kg${X}449Ft/Kg 581Ft + Metal scourers 3pcs 299Ft + Red onion 1kg 2Db${X}277Ft/Db 554Ft + Milk chocolate bar 100g 2Db${X}459Ft/Db 918Ft + UHT milk 2.8% 1L 2Db${X}285Ft/Db 570Ft + Natural yogurt 3% 175g 85Ft + Chocolate donut 2Db${X}159Ft/Db 318Ft = 3.894 Ft`,
  'TOTAL - 4.741 Ft',
].join('\n');

// ---- Golden test 2 ---------------------------------------------------------

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

export const golden3Expected = [
  '07/11/2026',
  `TESCO => Dates 200g 449Ft + Milka Alpine milk chocolate 90g 2Db${X}699Ft/Db 1.398Ft + Bio bag 19Ft ${M} Clubcard discount 100Ft ${M} Clubcard discount 400Ft = 1.366 Ft`,
  'TOTAL - 1.366 Ft',
].join('\n');
