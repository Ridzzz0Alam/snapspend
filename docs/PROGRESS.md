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
- [x] Install expo-dev-client; `npx expo run:android` builds and launches on a device (OnePlus 7, Android 12, 2026-11-26)
- [x] Jest (`jest-expo`) configured with one passing sample test
- [x] `.gitignore` covers `.env*`, `*.keystore`, `android/`, `ios/` (prebuild output) unless decided otherwise in DECISIONS.md
- [x] Create `docs/DECISIONS.md`
- How to verify:
  1. One-time machine setup: JDK 17, plus the Android SDK in `%LOCALAPPDATA%\Android\Sdk` with platform-tools, `platforms/android-37.0`, `build-tools;37.0.0`, `ndk;27.1.12297006` and `cmake/3.31.6` (DECISIONS D33, D35).
  2. Phone: Developer options → Wireless debugging (same Wi-Fi as the PC). The first time only, `adb pair <ip>:<pairing-port> <code>`. Then `adb connect <ip>:<port>`, using the port from the main Wireless debugging screen, which changes each time it's toggled.
  3. In PowerShell: `$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17.0.21.10002-hotspot"; $env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"; npx expo run:android`. The first build takes about 10–20 minutes; cached rebuilds take a few minutes.
  4. The app installs, opens and shows the template "Tab One" screen. For JS-only work afterwards, `npx expo start --dev-client` is enough (no rebuild needed).
  5. `npx tsc --noEmit` and `npx jest` pass.

## Phase 1 — Pure logic + golden tests (no UI)
- [x] `src/lib/money.ts`: `formatFt(n)` with `.` thousands separators; `parseHuf(str)` for "1 059", "1.059", "1059 Ft"
- [x] `src/lib/format.ts`: `formatDailyLog(receipts, { grandTotal })` per SPEC §6
- [x] Golden tests 1, 2 and 3 from SPEC §6 pass byte for byte
- [x] `src/lib/totals.ts`: computedTotal, day totals, sanity-check diff
- [x] `src/lib/receiptSchema.ts`: zod schema mirroring SPEC §5 + tests with valid/invalid fixtures
- [x] `src/lib/normalize.ts`: normalizedKey + store alias application, tested
- How to verify: run `npx tsc --noEmit` and `npx jest`. Both pass. `__tests__/format.test.ts` checks golden tests 1–3 byte for byte, and also checks that the fixture strings match the blocks in `docs/SPEC.md` §6 exactly. No UI in this phase. Started before Phase 0's device item was done (DECISIONS D22).

## Phase 2 — Database
- [x] drizzle schema per SPEC §4, migrations via drizzle-kit, run on app start
- [x] Repository functions: createReceiptWithItems (transaction), updateReceipt, deleteReceipt, listByDateRange, listItems(filters, sort)
- [x] Seed script (dev only) that loads the golden-test data so screens have something to show
- How to verify:
  1. `npx tsc --noEmit` and `npx jest` pass. `__tests__/repository.test.ts` runs the real migrations on an in-memory SQLite (sql.js). It covers create/update/delete, cascades, rollback, date-range and item listing, and runs the golden receipts through the database → `formatDailyLog` → byte-for-byte SPEC §6 output.
  2. On the phone (checked on the OnePlus 7, 2026-11-26): open the app; it starts normally, so the migrations ran. Go to **Tab Two** → "Receipts stored: 0" → **Load sample data** → the count goes to 6 straight away (live query) and the Daily Log for 02/11–13/11/2026 appears → **Clear sample data** → back to 0.
  3. Adding expo-sqlite/expo-crypto needed one native rebuild (`npx expo run:android`, 1m 27s cached). After changing `src/db/schema.ts`, run `npm run db:generate` and commit the new migration.

## Phase 3 — Settings + Gemini client
- [x] (Sync prep, DECISIONS D44) Soft delete: `receipts.deletedAt` + migration; `deleteReceipt` sets it; every list/total query skips deleted rows; tests updated
- [x] Settings screen: API key in expo-secure-store (masked), model name, "Test key" button (tiny text-only request)
- [x] `src/lib/gemini.ts`: build request, fetch with timeout + one retry, parse → zod → typed result; errors as typed results not throws
- [x] Unit tests with mocked fetch: success, malformed JSON, 400, 429, timeout
- How to verify:
  1. `npx tsc --noEmit` and `npx jest` pass (208 tests). Main files: `__tests__/gemini.test.ts` (Test key, error mapping), `__tests__/geminiReceipt.test.ts` (request shape, retry on 429/5xx, no retry on 400/network/timeout, malformed JSON, schema failures, blocked/empty/truncated answers, key never in errors), `__tests__/receiptPrompt.test.ts` (prompt and responseSchema match SPEC §5 exactly) and `__tests__/repository.test.ts` (soft delete).
  2. On the phone (OnePlus 7, 2026-11-28): the native rebuild for `expo-secure-store` installs and launches. The **Settings** tab shows the key field, model `gemini-3.8-flash` and **Test key**. A fake key gives "The Gemini API key was rejected" plus Google's HTTP 400 reason; the real key gives "✓ Key works with gemini-3.8-flash". Save / Replace / Remove work, and a `.env` key (dev builds only, D52) is shown with its own note.
  3. Real receipt check, done from the PC with the `.env` key: a drawn SPAR receipt sent through `extractReceipt` came back fully correct (4 items including 0.792 kg bananas, card 4821, Repont 100 as `points`). The scan screen in Phase 4 is the on-phone end-to-end test.
  4. Soft delete: the phone's database shows migration `0001_soft_delete` applied (`receipts.deleted_at` exists).

## Phase 4 — Scan → Review → Save
- [x] Scanner via react-native-document-scanner-plugin (multi-page) + gallery fallback via expo-image-picker (multi-select = batch queue)
- [x] Compress with expo-image-manipulator; save **the compressed copy** (not the original) in app storage (D45)
- [x] Review screen with editable rows, adjustments, category picker, sanity-check banner, duplicate warning
- [x] Save in a single transaction; Retry and Discard work
- [x] Manual "Add expense" form (kind manual / total_only)
- How to verify:
  1. `npx tsc --noEmit` and `npx jest` pass (258 tests). Main files: `__tests__/scanQueue.test.ts` (queue steps, one job at a time, retry from the right step), `__tests__/reviewDraft.test.ts` (Gemini answer → editable form → validated input, field errors, live sanity check, manual entries), `__tests__/images.test.ts`, `__tests__/dates.test.ts`, and `__tests__/repository.test.ts` (`findDuplicates`, preset receipt id, receipt category).
  2. Native rebuild needed once for the scanner, image picker, image manipulator and file system (`npx expo run:android`, or prebuild + `./gradlew :app:assembleDebug` + `adb install`). The app has no camera or microphone permission.
  3. On the phone (OnePlus 7, 2026-11-28):
     - **Scan tab → Scan receipt** on a real TESCO receipt, then Review and Save. It appears in the Daily Log on Tab Two.
     - **Import from gallery** with several photos: each becomes its own queued receipt. A saved ALDI receipt had 6 items, including 1.312 kg bananas, and its items matched the printed total.
     - **Retry with Gemini** and **Discard** work, and **Add expense** works. Its save uses the same `saveReceipt` code as Review, but no manual entry had been saved on the phone by 2026-11-28.
     - Each saved receipt has one compressed `files/receipts/<id>/page-1.jpg` (~120–170 KB, D45).
  4. The S23 Ultra end-to-end scan (originally planned here) is still to do; it's covered by the Phase 8 two-phone smoke test.

## Phase 5 — Daily Log screen
- [x] Range presets + custom picker
- [x] Monospace selectable output from `formatDailyLog`
- [x] Copy (expo-clipboard) and Share buttons, GRAND TOTAL toggle
- How to verify:
  1. `npx tsc --noEmit` and `npx jest` pass (268 tests). `__tests__/ranges.test.ts` covers the presets (week from Monday, across month, year and leap-year boundaries), backwards custom ranges, the GRAND TOTAL default and range labels. The log text itself is covered by the SPEC §6 golden tests.
  2. Native rebuild needed once for `expo-clipboard` and `@react-native-community/datetimepicker`.
  3. On the phone (OnePlus 7, 2026-11-28), **Daily Log** tab:
     - **This week** shows both saved receipts, with `GRAND TOTAL - 3,839 Ft` switched on by default.
     - **Today** (no receipts) shows "No receipts in this range" and switches GRAND TOTAL off.
     - **Copy** shows "Copied ✓"; **Share** opens the Android share sheet.
     - **Custom** opens the calendar for From / To and filters correctly; **Last month** shows nothing.
     - The log is in Google Sans Code and can be selected.

## Phase 6 — Items tracker + price history
- [x] FlashList of items, sort + filter + search, filtered-total footer
- [x] Price history screen: line chart of unit price over time, cheapest store, last paid
- How to verify:
  1. `npx tsc --noEmit` and `npx jest` pass (276 tests). `__tests__/priceHistory.test.ts` covers unit price (printed, or total ÷ qty), oldest-first points, last paid, cheapest (newest wins a tie), average, mixed pcs/kg, skipping returns, and the footer sum. `__tests__/repository.test.ts` covers the `normalizedKey` filter and `listStores`, both skipping deleted receipts.
  2. Native rebuild needed once for `@shopify/flash-list`, `react-native-svg`, `expo-linear-gradient` (used by the chart) and `react-native-gifted-charts`.
  3. On the phone (OnePlus 7, 2026-11-28):
     - The **Items** tab lists all 9 real items, newest first, with kg lines as `1.312 kg × 489.00 Ft/kg`, and the footer `9 items · 3,789.00 Ft`.
     - **Search**, **sort** (tap again to flip ↑/↓) and **Filters** (date range, stores, categories, Clear all) all work and update the footer total.
     - Tapping "Beans in sauce 420g" opens **Price history**: Last paid / Cheapest cards, average, times bought, total spent, the chart and the purchase list.
     - The sample-data buttons are now at the bottom of Settings (dev builds only).

## Phase 7 — Home + Insights
- [x] Home: month total, today, recent receipts, scan + add buttons
- [x] Insights: 12-month bars, by store, by category, top items, per-card totals
- [x] Receipt detail screen with zoomable image, edit, delete
- How to verify:
  1. `npx tsc --noEmit` and `npx jest` pass (289 tests). `__tests__/insights.test.ts` covers the 12-month list across a year boundary, monthly totals, by store / category / card, the net "Discounts & charges" row (categories add up to the total), and top items with average price. `__tests__/repository.test.ts` covers `getReceipt` (null when deleted) and `listRecent`. `__tests__/reviewDraft.test.ts` checks that a saved receipt goes through the edit form and back unchanged.
  2. One native rebuild was needed: `react-native-gesture-handler` became a direct dependency at Expo's pinned 3.3.0.
  3. On the phone (OnePlus 7, 2026-11-28):
     - **Home** shows the month total (3,839.00 Ft, 2 receipts), today's total, Scan / Add expense and the last 5 receipts.
     - **Insights** shows the 12-month bars (tap a bar or ‹ ›), and by store, category and card for the month; Fruit & Veg 1,481 = 839 + 642.
     - **Receipt detail** (tap a receipt on Home) shows the photo; the full-screen viewer has pinch zoom, drag and double-tap reset.
     - Editing and saving shows up everywhere. Delete removes the receipt from every screen.

## Phase 8 — Backup, polish, release APK
- [ ] CSV export (items), JSON backup export/import (round-trip test); import **merges** by id + `updatedAt` (D44)
- [ ] Store alias + category editors in Settings
- [ ] Image retention setting: delete receipt images older than Never / 6 months / 1 year; data stays (D46)
- [ ] Dark/light theme, empty states, loading and error states everywhere
- [ ] App icon + splash
- [ ] Release signing with a local keystore (kept out of git); `cd android && ./gradlew assembleRelease` produces an APK (check the release bundle has no `EXPO_PUBLIC_GEMINI_API_KEY` value, D52)
- [ ] Install and smoke-test on **both** S23 Ultra and OnePlus 7 (Android 12)
- [ ] `README.md`: setup, run, build APK, where the key goes, backup instructions
- How to verify:

## Phase 9 — Two-phone cloud sync (DECISIONS D43)
- [ ] Decide whether receipt images sync too (needs file storage, not Neon) (D46)
- [ ] Choose the sync approach (own small API vs. a ready-made SQLite↔Postgres sync service); check current Expo + drizzle support; record in DECISIONS
- [ ] Neon project + schema; credentials only on the server/sync service, never in the APK
- [ ] Sign-in so only the owner's phones can sync
- [ ] Background sync of receipts, items, adjustments, store aliases (incl. soft deletes); last write wins by `updatedAt`
- [ ] Sync status in Settings (last synced, errors, "Sync now")
- [ ] Test with both phones: add, edit and delete on each and confirm both match, including after being offline
- How to verify:

## Backlog (not scheduled)
- [ ] Other AI providers for receipt reading (OpenRouter / OpenCode → DeepSeek, GLM, Kimi…), selectable in Settings; Gemini stays the default (DECISIONS O3)
