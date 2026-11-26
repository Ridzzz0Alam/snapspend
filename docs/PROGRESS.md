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
- [ ] (Sync prep, DECISIONS D44) Soft delete: `receipts.deletedAt` + migration; `deleteReceipt` sets it; every list/total query skips deleted rows; tests updated
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
- [ ] CSV export (items), JSON backup export/import (round-trip test); import **merges** by id + `updatedAt` (D44)
- [ ] Store alias + category editors in Settings
- [ ] Dark/light theme, empty states, loading and error states everywhere
- [ ] App icon + splash
- [ ] Release signing with a local keystore (kept out of git); `cd android && ./gradlew assembleRelease` produces an APK
- [ ] Install and smoke-test on **both** S23 Ultra and OnePlus 7 (Android 12)
- [ ] `README.md`: setup, run, build APK, where the key goes, backup instructions
- How to verify:

## Phase 9 — Two-phone cloud sync (DECISIONS D43)
- [ ] Choose the sync approach (own small API vs. a ready-made SQLite↔Postgres sync service); check current Expo + drizzle support; record in DECISIONS
- [ ] Neon project + schema; credentials only on the server/sync service, never in the APK
- [ ] Sign-in so only the owner's phones can sync
- [ ] Background sync of receipts, items, adjustments, store aliases (incl. soft deletes); last write wins by `updatedAt`
- [ ] Sync status in Settings (last synced, errors, "Sync now")
- [ ] Test with both phones: add, edit and delete on each and confirm both match, including after being offline
- How to verify:
