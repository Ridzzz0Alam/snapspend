# Snap Spend — Product Spec

## 1. Purpose
Photograph grocery and shop receipts (mostly Hungarian: SPAR/Interspar, TESCO, ALDI, LIDL, TEDI, Rossmann,
Praktiker, Kashmiri Bazar, Kohinoor Bazár…). Gemini extracts every line item, translated to English.
The app gives two core functions:

1. **Expense tracker** — all items in a local database; sort, filter, totals, charts, price history.
2. **Daily Log** — a text view in the owner's exact format (§6), copyable and shareable.

Currency is HUF (Ft). Dates are displayed `DD/MM/YYYY`. The UI is in English.

## 2. Screens (bottom tabs)

### 2.1 Home
- Current-month total, today's total, last 5 receipts.
- Big **Scan receipt** button and a smaller **Add expense** button (manual).

### 2.2 Scan flow
1. Open the ML Kit document scanner (auto-crop). Allow multiple pages (long receipts). Gallery import as an alternative. **Batch mode:** select several receipt photos from the gallery and queue them.
2. Compress → base64 → Gemini (§5). Show a progress state per receipt.
3. **Review screen** (always shown before saving):
   - Store name, date, payment card last 4 (optional), printed total
   - Editable item rows: English name, original name (small, grey), qty, unit, unit price, line total, category
   - Discount rows (Clubcard, Repont points, coupons) and extra charges (service charge, deposit) shown separately
   - **Sanity check banner**: computed sum (items − discounts + charges) vs printed total. Green if equal, amber with the difference if not.
   - Buttons: Save, Retry with Gemini, Discard
4. Duplicate guard: warn if a receipt with the same store, date and total already exists.

### 2.3 Manual expense
- For card-only slips with no item list (e.g. Kashmiri Bazar, Crown Express) and non-receipt spending
  (e.g. "Yettel Recharge", "University Coffee Machine", "Skrill Card Recharge").
- Fields: date, store/label, total, optional category, optional note, optional photo.
- Stored as a receipt with zero items and `kind = 'manual'` or `kind = 'total_only'`.

### 2.4 Daily Log
- Date range picker (presets: This week, This month, Last month, Custom).
- Renders the §6 text in a monospace, selectable block.
- **Copy** and **Share** buttons. Option: "Include GRAND TOTAL" (on by default when the range has more than one day).

### 2.5 Items / Tracker
- Flat list of all items across receipts (FlashList).
- Sort: date (default newest), amount, name, store, category.
- Filter: date range, store (multi-select), category (multi-select), text search (matches English and original name).
- Footer shows the total of the filtered rows.
- Tap an item → **Price history** for that product: chart of unit price over time, cheapest store, last paid.
  Matching key = normalized English name (lowercase, trimmed, sizes kept, e.g. "uht milk 2.8% 1l").

### 2.6 Insights
- Monthly total bar chart (last 12 months).
- Spending by store (pie or bar) and by category for the selected month.
- Top 10 most-bought items (by count) with average price.
- Per-card totals (card last 4).

### 2.7 Receipt detail (`receipt/[id]`)
- Receipt image (zoomable), all fields editable, delete receipt.

### 2.8 Settings
- Gemini API key (secure store, masked, "Test key" button).
- Gemini model name (text field, default = current Gemini Flash model; check the Gemini API docs for the latest stable Flash model id at build time).
- Default store aliases (e.g. "INTERSPAR" → "SPAR (Interspar)").
- Category list editor.
- Export: CSV (items) and JSON (full backup incl. receipts). Import JSON backup. Use the Android share sheet / SAF.
- Clear all data (with confirmation).

## 3. Categories (default, editable)
Dairy & Eggs, Bakery, Fruit & Veg, Meat & Fish, Pantry (canned, rice, oil, spices), Snacks & Sweets,
Drinks & Coffee, Frozen, Household & Cleaning, Personal care, Eating out, Phone & Top-ups, Other.

## 4. Data model (drizzle, SQLite)

```ts
receipts {
  id: text pk (uuid)
  kind: text  // 'scanned' | 'total_only' | 'manual'
  store: text
  date: text  // ISO 'YYYY-MM-DD'
  time: text | null  // 'HH:MM'
  printedTotal: integer  // Ft
  computedTotal: integer // Ft, items - discounts + charges
  cardLast4: text | null
  paymentMethod: text | null // 'card' | 'cash' | 'points+card' ...
  imagePaths: text | null    // JSON array of file URIs
  rawGeminiJson: text | null // keep for debugging / re-parse
  note: text | null
  createdAt: integer, updatedAt: integer
}

items {
  id: text pk
  receiptId: text fk -> receipts.id (cascade delete)
  position: integer          // order on receipt
  nameEn: text               // "Chocolate donut"
  nameOriginal: text | null  // "GYŰRŰS FÁNK CSOKI"
  sizeLabel: text | null     // "100g", "1L", "3pcs"
  quantity: real             // 2, 0.792
  unit: text                 // 'pcs' | 'kg'
  unitPrice: integer | null  // Ft per pcs or per kg
  lineTotal: integer         // Ft
  category: text
  normalizedKey: text        // for price history
}

adjustments {
  id: text pk
  receiptId: text fk
  type: text                 // 'discount' | 'charge' | 'points'
  label: text                // "Clubcard discount", "Service charge 10%", "Repont"
  amount: integer            // positive number; sign implied by type
  appliesTo: text | null     // item name, if known
}

storeAliases { raw: text pk, canonical: text }
```

Indexes: `receipts(date)`, `items(receiptId)`, `items(normalizedKey)`, `items(category)`.

## 5. Gemini contract

**Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent`
Header `x-goog-api-key: <key>`, `Content-Type: application/json`.
Body: one user turn with the text prompt plus one `inline_data` part per page (`mime_type: image/jpeg`, base64).
`generationConfig`: `temperature: 0.1`, `responseMimeType: "application/json"`, `responseSchema` (below).
Timeout 60s, one automatic retry on 5xx/429 with backoff. Show friendly errors for 400 (bad key) and network loss.

**Prompt text:**
```
You are reading a shop receipt, most likely from Hungary (Hungarian language, HUF currency).
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
Categories: {CATEGORY_LIST}
```

**responseSchema** (Gemini OpenAPI subset):
```json
{
  "type": "OBJECT",
  "properties": {
    "kind": { "type": "STRING", "enum": ["scanned", "total_only"] },
    "store": { "type": "STRING" },
    "date": { "type": "STRING" },
    "time": { "type": "STRING", "nullable": true },
    "cardLast4": { "type": "STRING", "nullable": true },
    "paymentMethod": { "type": "STRING", "nullable": true },
    "items": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "nameEn": { "type": "STRING" },
          "nameOriginal": { "type": "STRING", "nullable": true },
          "sizeLabel": { "type": "STRING", "nullable": true },
          "quantity": { "type": "NUMBER" },
          "unit": { "type": "STRING", "enum": ["pcs", "kg"] },
          "unitPrice": { "type": "INTEGER", "nullable": true },
          "lineTotal": { "type": "INTEGER" },
          "category": { "type": "STRING" }
        },
        "required": ["nameEn", "quantity", "unit", "lineTotal", "category"]
      }
    },
    "adjustments": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "type": { "type": "STRING", "enum": ["discount", "charge", "points"] },
          "label": { "type": "STRING" },
          "amount": { "type": "INTEGER" },
          "appliesTo": { "type": "STRING", "nullable": true }
        },
        "required": ["type", "label", "amount"]
      }
    },
    "printedTotal": { "type": "INTEGER" },
    "confidence": { "type": "NUMBER" },
    "notes": { "type": "ARRAY", "items": { "type": "STRING" } }
  },
  "required": ["kind", "store", "date", "items", "adjustments", "printedTotal"]
}
```
Mirror this exactly in `src/lib/receiptSchema.ts` with zod. After parsing: apply store aliases, compute
`normalizedKey`, compute `computedTotal`. Note: "points" (Repont) is a payment method, not a discount; it does **not** reduce `computedTotal` vs `printedTotal` when printedTotal is the pre-points total — record it, show it, and let the sanity check compare against the receipt's total before point redemption.

## 6. Daily Log format (exact contract)

### Rules
- One block per day, days ascending, a blank line between days.
- Line 1: date `DD/MM/YYYY`.
- One line per receipt, in time order: `STORE => item + item + ... = TOTAL Ft`
- Item token:
  - qty 1, pcs: `{nameEn}[ {sizeLabel}] {lineTotal}Ft`
  - qty > 1, pcs: `{nameEn}[ {sizeLabel}] {qty}Db×{unitPrice}Ft/Db {lineTotal}Ft`
  - kg: `{nameEn}[ {sizeLabel}] {qty with 3 decimals}Kg×{unitPrice}Ft/Kg {lineTotal}Ft`
- Adjustments appended after items: discounts ` − {label} {amount}Ft`, charges ` + {label} {amount}Ft`.
- Store total: ` = {total} Ft` (note the space before Ft). Item amounts have **no** space before Ft.
- `total_only` / `manual` receipts: `STORE => {total} Ft` (no items, no `=`).
- Day footer: `TOTAL - {dayTotal} Ft`
- Range footer (optional): blank line, then `GRAND TOTAL - {sum} Ft`
- Numbers: thousands separator `,`, no separator below 1000. `847`, `3,894`, `10,076` (owner's choice 2026-11-28, DECISIONS D57; was `.` before).
- Use the Unicode `×` (U+00D7) and `−` (U+2212) characters.

### Golden test 1 (must match byte for byte)
```
02/11/2026
ALDI => Sauce beans 420g 239Ft + Sauce beans 420g 239Ft + Toast bread 500g 369Ft = 847 Ft
SPAR (Interspar) => Corn snack 100g 2Db×155Ft/Db 310Ft + Peeled tomatoes 400g 259Ft + Banana 1.294Kg×449Ft/Kg 581Ft + Metal scourers 3pcs 299Ft + Red onion 1kg 2Db×277Ft/Db 554Ft + Milk chocolate bar 100g 2Db×459Ft/Db 918Ft + UHT milk 2.8% 1L 2Db×285Ft/Db 570Ft + Natural yogurt 3% 175g 85Ft + Chocolate donut 2Db×159Ft/Db 318Ft = 3,894 Ft
TOTAL - 4,741 Ft
```
(Kg quantities print with `.` as decimal: `1.294Kg`. This intentionally mirrors the owner's existing logs.)

### Golden test 2 (total-only + manual + grand total)
```
06/11/2026
SPAR => Sweet corn 285g 299Ft + Chopped tomatoes 2Db×295Ft/Db 590Ft = 889 Ft
Kashmiri Bazar => 6,490 Ft
TOTAL - 7,379 Ft

13/11/2026
Yettel Recharge => 3,000 Ft
TOTAL - 3,000 Ft

GRAND TOTAL - 10,379 Ft
```

### Golden test 3 (discount)
```
07/11/2026
TESCO => Dates 200g 449Ft + Milka Alpine milk chocolate 90g 2Db×699Ft/Db 1,398Ft + Bio bag 19Ft − Clubcard discount 100Ft − Clubcard discount 400Ft = 1,366 Ft
TOTAL - 1,366 Ft
```

## 7. Non-functional
- Fully offline except the Gemini call. No accounts, no analytics.
- App start < 2s on the OnePlus 7. Lists stay smooth with 5,000+ items.
- Dark and light theme follow the system.
- Accessibility: tappable targets ≥ 44dp, labels on icon buttons.
- App name **Snap Spend**, Android package `com.snapspend.app`, simple icon (receipt + camera shutter), splash screen.
