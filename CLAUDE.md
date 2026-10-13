# Ember — habits, food & a fox spirit

Timo's gamified life tracker: habits (piano, Valorant, Geometry Dash, …) and a free
Yazio-style food/protein tracker, glued together by a pet that lives or leaves
depending on how consistent he is. **UI language: English.**

Full product plan: `docs/PLAN.md` (approved 2026-10-13). Phases 1–5 there.

## Commands

- `npm run dev` — dev server on port 5180 (also `.claude/launch.json` → "ember")
- `npm test` — vitest (engine, schedule, nutrition, sync)
- `npm run build` — typecheck + production build (PWA, service worker)
- `npm run icons` — re-render PNG icons from `public/icons/icon.svg` (macOS QuickLook)
- Dev-only page `/dev/pets` shows every pet stage × mood.

## Architecture

- **Vite + React 19 + TS + Tailwind v4 + Dexie + vite-plugin-pwa.** Dark UI, ember-orange accent, `ui-rounded` font.
- **Local-first.** Everything lives in IndexedDB (`src/db/db.ts`). Every synced record has `id`, `updatedAt` (REAL wall-clock ms), `deleted` (0/1 tombstone) and `deviceId`. **All writes go through `src/db/repo.ts` (`save`/`remove`)** so metadata is set and the future sync client is notified. Never `db.x.put` directly for synced tables.
- **The game is never stored.** `src/core/game/engine.ts` `replay()` folds over every day from the pet's `startDay` and recomputes HP, bond XP, coins, streaks, freezes, run-away/rescue and finds from the logs. All balance numbers live in `src/core/game/rules.ts`; changing them re-scores history. Randomness is seeded by the day string (`dayRandom`) so replays are stable.
- **Past days are settled, today is a projection.** Today credits XP/coins immediately, but HP/streak change only when the day ends. The pet's first day (`startDay`) can heal but never hurt (`firstDayGrace`).
- **Logical days** (`src/core/date.ts`): a day starts at `prefs.dayStartHour` (default 04:00). Day strings are parsed at local noon so DST never breaks arithmetic. Tests pin `TZ=Europe/Berlin`.
- **Schedules** (`src/core/habits/schedule.ts`): `daily | weekdays | perWeek`. A per-week habit is `open` until skipping would make the weekly goal impossible, then `due`; done days count as `due` until the goal is met, after that as `bonus`. Manual and auto logs for the same habit/day merge by **max**.
- **Manual log ids are deterministic** (`m:<habitId>:<day>`), auto-check ids too (`auto:<source>:<habitId>:<day>`) — so two devices / repeated server runs merge into one record instead of duplicating.
- **Editing window:** today and yesterday only (Today page toggle). Vacation mode starts today at the earliest — it can't erase past days.
- **Sandbox** (`src/core/sandbox.ts`): separate DB `ember-sandbox` + a day offset ("time machine") for testing the game. `nowMs()` is the only clock game code may use. `updatedAt` always uses real `Date.now()`.
- `src/state/game.tsx` — `GameProvider` live-queries Dexie and runs `replay()` once per change; components read it via `useGame()`.
- `src/features/<area>/` — today, habits, pet (PetView SVG, shop), settings, onboarding, events (one-time pop-ups for evolve/find/run-away/rescue, de-duplicated via `meta.seenEvents`).
- **PetView** is pure SVG with SMIL animation (SMIL keeps SVG coordinate semantics in Safari; CSS transforms on SVG groups don't). Tail count/size/extras come from `RULES.stages`.

## Conventions

- Custom CSS classes that utilities must be able to override go in `@layer components` (unlayered CSS beats Tailwind utilities in v4).
- Pure logic in `src/core/**` with tests next to it (`*.test.ts`, node env).
- iPhone is the main device: test at 375×812, respect safe areas (`pt-safe`/`pb-safe`), inputs ≥16px.

## Deploy

GitHub Pages via `.github/workflows/pages.yml` (sets `BASE_PATH=/<repo>/`, copies `index.html` → `404.html`). An installed web app keeps its data per origin, so the URL must never change.

## Status

- Phase 1 (habits + pet, local only) — in progress / see git log.
