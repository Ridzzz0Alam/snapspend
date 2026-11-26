# Snap Spend — How to run the build harness

## 0. One-time machine setup (Windows/macOS/Linux)
- Node.js LTS, Git
- Android Studio (Android SDK + platform tools), JDK 17
- On each phone: Developer options → USB debugging on. Check `adb devices` lists it.
- Claude Code (or another coding agent) installed in your terminal
- A Gemini API key from Google AI Studio (you'll paste it into the app's Settings, not the code)

## 1. Prepare the folder
```
mkdir snap-spend && cd snap-spend
git init
# copy in: CLAUDE.md, PROMPTS.md, docs/SPEC.md, docs/PROGRESS.md
git add . && git commit -m "chore: build harness"
```
Plug in the S23 Ultra over USB.

## 2. Kickoff prompt (paste once, first session)
```
Read CLAUDE.md, docs/SPEC.md and docs/PROGRESS.md fully.
Then summarise in 10 lines what you are building and list anything in the spec you think is
ambiguous or risky (especially native module compatibility with the current Expo SDK).
Write your resolutions to docs/DECISIONS.md.
Then start Phase 0 and follow the loop below until Phase 0 is complete. Stop after Phase 0 and report.
```

## 3. Loop prompt (paste at the start of every following session)
```
Continue building Snap Spend.

1. Read CLAUDE.md, docs/PROGRESS.md and docs/DECISIONS.md. Skim docs/SPEC.md sections relevant to the current phase.
2. Find the first unchecked item in the first incomplete phase. That is your only scope.
3. For that item:
   a. Plan briefly (3–6 bullets).
   b. If it is logic in src/lib, write the tests first, then the code.
   c. Implement.
   d. Run `npx tsc --noEmit` and `npx jest`. Fix until green.
   e. If it touches UI or native modules, run `npx expo run:android` and confirm it launches.
   f. Tick the item in PROGRESS.md, commit with a conventional message.
4. Repeat step 3 for the next item in the same phase.
5. When the phase is complete: fill in its "How to verify" steps, commit, and STOP.
   Report: what was built, how I can test it on my phone, and anything you decided or deferred.

Rules: don't start the next phase without me. Don't change the stack. If blocked after 2 attempts,
write it under ## BLOCKED in PROGRESS.md and stop.
```

## 4. Between sessions (you)
- Follow the phase's "How to verify" on the phone.
- Found a bug? Next session, start with:
  `Bug in Phase N: <what you did> → <what happened> → <what you expected>. Add a failing test first if it's logic, fix it, then continue the loop.`
- Want a change? Edit docs/SPEC.md yourself (or ask the agent to) **before** the phase that builds it.

## 5. Optional: unattended loop
With Claude Code you can run phases non-interactively, one at a time:
```
claude -p "$(sed -n '/^## 3. Loop prompt/,/^## 4/p' PROMPTS.md | sed '1,2d;$d')"
```
Review the diff and test on the phone after each run before starting the next. Don't chain all phases
blindly: Phase 4 (scanner + Gemini) needs your real receipts to validate.

## 6. Accuracy tuning (after Phase 4)
Scan 10–15 of your real receipts (mix SPAR, TESCO, ALDI, TEDI, a Kashmiri card slip). Then:
```
Here are the receipts where extraction was wrong: <list store/date and what was wrong>.
Look at rawGeminiJson for those receipts, improve the prompt in src/lib/gemini.ts (keep the schema),
add the failure cases as test fixtures, and re-run.
```

## 7. Build the APK to install on both phones
```
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```
Copy the same APK to the OnePlus 7 and install it there (allow "install unknown apps").
Keep the keystore file and its password safe. You need the same key to install updates over the existing app.
