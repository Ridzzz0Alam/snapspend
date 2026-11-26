/** Sample Gemini responses (SPEC §5 shape) for schema and normalization tests. */

export const validScanned = {
  kind: 'scanned',
  store: 'INTERSPAR',
  date: '2026-11-02',
  time: '17:40',
  cardLast4: '**** **** **** 4821',
  paymentMethod: 'card',
  items: [
    {
      nameEn: 'UHT milk 2.8%',
      nameOriginal: 'UHT TEJ 2,8% 1L',
      sizeLabel: '1L',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 285,
      lineTotal: 570,
      category: 'Dairy & Eggs',
    },
    {
      nameEn: 'Banana',
      nameOriginal: 'BANÁN',
      sizeLabel: null,
      quantity: 1.294,
      unit: 'kg',
      unitPrice: 449,
      lineTotal: 581,
      category: 'Fruit & Veg',
    },
    // Optional fields omitted entirely, as Gemini sometimes does.
    {
      nameEn: 'Bio bag',
      quantity: 1,
      unit: 'pcs',
      lineTotal: 19,
      category: 'Household & Cleaning',
    },
  ],
  adjustments: [{ type: 'points', label: 'Repont', amount: 100, appliesTo: null }],
  printedTotal: 1070,
  confidence: 0.93,
  notes: [],
};

export const validTotalOnly = {
  kind: 'total_only',
  store: 'Kashmiri Bazar',
  date: '2026-11-06',
  items: [],
  adjustments: [],
  printedTotal: 6490,
};
