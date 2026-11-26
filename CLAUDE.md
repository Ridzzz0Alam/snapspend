# CLAUDE.md — Snap Spend

You are building **Snap Spend**, a personal Android receipt-scanning expense tracker.
Owner: a single user in Debrecen, Hungary. Not published to any store. Installed by sideloading an APK.

Read these before doing anything, every session:
1. `docs/SPEC.md` is the source of truth for features, data model, Gemini contract and output format.
2. `docs/PROGRESS.md` is the phased checklist. Work only on the **first unchecked phase**.
3. `docs/DECISIONS.md` records decisions already made (create it if missing). Don't re-litigate them.

## Target devices
- Samsung Galaxy S23 Ultra (recent Android) and OnePlus 7 (Android 12).
- `minSdkVersion` 24 (Android 7.0) or the Expo SDK default if higher. Must run on both phones.
- Android only. Ignore iOS (don't break it on purpose, but never test or configure for it).

## Stack (fixed — do not swap without asking)
- Expo (latest stable SDK) + React Native + **TypeScript strict mode**
- Expo Router (file-based navigation, tabs)
- **Development build**, not Expo Go (the document scanner is a native module). Build locally with `npx expo run:android`.
- `expo-sqlite` + `drizzle-orm` (driver `expo-sqlite`, migrations via `drizzle-kit`, `useLiveQuery` for reactive lists)
- `react-native-document-scanner-plugin` (ML Kit document scanner) for capture; `expo-image-picker` as gallery fallback
- `expo-image-manipulator` to resize and compress before upload (long edge ≈ 1600px, JPEG ~0.7)
- `expo-file-system` to keep receipt images in the app's document directory
- `expo-secure-store` for the Gemini API key (entered in Settings, **never hardcoded, never committed**)
- `expo-clipboard` + React Native `Share` for the daily log export
- `react-native-gifted-charts` (+ `react-native-svg`) for charts
- `@shopify/flash-list` for long lists
- `zod` to validate every Gemini response
- Jest (`jest-expo`) for unit tests
- Gemini via **plain `fetch` to the REST API**. No SDK.

## Hard rules
- **Money is stored as integer forints.** Never floats for money. Quantities may be REAL (e.g. 0.792 kg).
- All Gemini output passes through zod validation before touching the DB. Invalid → show the error and allow manual edit or retry. Never crash.
- Never log or print the API key. `.env*`, `*.keystore` and `credentials*` go in `.gitignore`.
- Formatting of the Daily Log must match `docs/SPEC.md §6` **exactly**. The golden tests there are the contract.
- Keep business logic (formatting, totals, validation, Gemini parsing) in `src/lib/` as pure, unit-tested TypeScript. Screens stay thin.
- Run `npx tsc --noEmit` and `npx jest` before you mark anything done. Both must pass.
- Small commits, one per completed checklist item, conventional messages (`feat:`, `fix:`, `test:`, `chore:`).
- **No AI attribution in git.** Never add `Co-Authored-By` trailers or "Generated with Claude Code" lines to commits or PRs. Commits are authored solely by the owner's configured git identity, so the agent never appears as a co-author or in the GitHub Contributors tab.
- Git remote: `git@github.com:Ridzzz0Alam/snapspend.git` (branch `main`).
- If something in SPEC is ambiguous, choose the simplest reasonable option, write it in `docs/DECISIONS.md`, and continue.
- If you are blocked (missing tool, failing native build you cannot fix after 2 attempts), stop and write the blocker at the top of `docs/PROGRESS.md` under `## BLOCKED`.

## Folder layout
```
app/                 Expo Router screens: (tabs)/index, scan, log, insights, settings; receipt/[id]
src/db/              schema.ts, client.ts, migrations/
src/lib/             money.ts, format.ts (daily log), gemini.ts, receiptSchema.ts, totals.ts, categories.ts
src/components/      shared UI
src/hooks/
__tests__/           unit tests (mirrors src/lib)
docs/                SPEC.md, PROGRESS.md, DECISIONS.md
```

## Definition of done for a phase
All items checked, typecheck and tests green, app launches on a connected device or emulator via `npx expo run:android`,
and a short "How to verify" note added under the phase in PROGRESS.md.
