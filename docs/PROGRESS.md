# Snap Spend — Build Progress

Work top to bottom. Only the first phase with unchecked items is in scope.
Tick `[x]` as you finish each item, commit, and add a "How to verify" note when a phase is complete.

## BLOCKED
_(empty — write blockers here)_

---

## Phase 0 — Project setup
- [x] `npx create-expo-app@latest snap-spend --template` (TypeScript, Expo Router tabs) in this folder
- [x] TypeScript strict, ESLint + Prettier, path alias `@/` → `src/`
- [x] `app.json`: name "Snap Spend", slug `snap-spend`, android.package `com.snapspend.app`, orientation portrait
- [ ] Install expo-dev-client; `npx expo run:android` builds and launches on a device
- [x] Jest (`jest-expo`) configured with one passing sample test
- [ ] `.gitignore` covers `.env*`, `*.keystore`, `android/`, `ios/` (prebuild output) unless decided otherwise in DECISIONS.md
- [ ] Create `docs/DECISIONS.md`
- How to verify:

## Phase 1 — Pure logic + golden tests (no UI)
- [ ] `src/lib/money.ts`: `formatFt(n)` with `.` thousands separators; `parseHuf(str)` for "1 059", "1.059", "1059 Ft"
- [ ] `src/lib/format.ts`: `formatDailyLog(receipts, { grandTotal })` per SPEC §6
- [ ] Golden tests 1, 2 and 3 from SPEC §6 pass byte for byte
- [ ] `src/lib/totals.ts`: computedTotal, day totals, sanity-check diff
- [ ] `src/lib/receiptSchema.ts`: zod schema mirroring SPEC §5 + tests with valid/invalid fixtures
- [ ] `src/lib/normalize.ts`: normalizedKey + store alias application, tested
- How to verify:

## Phase 2 — Database
- [ ] drizzle schema per SPEC §4, migrations via drizzle-kit, run on app start
- [ ] Repository functions: createReceiptWithItems (transaction), updateReceipt, deleteReceipt, listByDateRange, listItems(filters, sort)
- [ ] Seed script (dev only) that loads the golden-test data so screens have something to show
- How to verify:

## Phase 3 — Settings + Gemini client
- [ ] Settings screen: API key in expo-secure-store (masked), model name, "Test key" button (tiny text-only request)
- [ ] `src/lib/gemini.ts`: build request, fetch with timeout + one retry, parse → zod → typed result; errors as typed results not throws
- [ ] Unit tests with mocked fetch: success, malformed JSON, 400, 429, timeout
- How to verify:

## Phase 4 — Scan → Review → Save
- [ ] Scanner via react-native-document-scanner-plugin (multi-page) + gallery fallback via expo-image-picker (multi-select = batch queue)
- [ ] Compress with expo-image-manipulator, copy originals into app storage
- [ ] Review screen with editable rows, adjustments, category picker, sanity-check banner, duplicate warning
- [ ] Save in a single transaction; Retry and Discard work
- [ ] Manual "Add expense" form (kind manual / total_only)
- How to verify: scan a real SPAR receipt end-to-end on the S23 Ultra.

## Phase 5 — Daily Log screen
- [ ] Range presets + custom picker
- [ ] Monospace selectable output from `formatDailyLog`
- [ ] Copy (expo-clipboard) and Share buttons, GRAND TOTAL toggle
- How to verify:

## Phase 6 — Items tracker + price history
- [ ] FlashList of items, sort + filter + search, filtered-total footer
- [ ] Price history screen: line chart of unit price over time, cheapest store, last paid
- How to verify:

## Phase 7 — Home + Insights
- [ ] Home: month total, today, recent receipts, scan + add buttons
- [ ] Insights: 12-month bars, by store, by category, top items, per-card totals
- [ ] Receipt detail screen with zoomable image, edit, delete
- How to verify:

## Phase 8 — Backup, polish, release APK
- [ ] CSV export (items), JSON backup export/import (round-trip test)
- [ ] Store alias + category editors in Settings
- [ ] Dark/light theme, empty states, loading and error states everywhere
- [ ] App icon + splash
- [ ] Release signing with a local keystore (kept out of git); `cd android && ./gradlew assembleRelease` produces an APK
- [ ] Install and smoke-test on **both** S23 Ultra and OnePlus 7 (Android 12)
- [ ] `README.md`: setup, run, build APK, where the key goes, backup instructions
- How to verify:
