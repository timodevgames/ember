# Ember: a habit and nutrition tracker with a pet to keep alive

*Working name. The pet is a fox spirit that grows more tails as it evolves; both names can be changed.*

## Context

Timo wants one free app to keep his regular habits going (piano, Valorant, Geometry Dash, anything else that repeats) and to track food the way Yazio does, with protein front and centre. A game layer should make him stick with it. The project folder is empty, so this is a new build. Yazio puts macro targets, AI logging and recipes behind PRO and shows ads; this app has none of that.

**Decisions from the Q&A**

| Topic | Choice |
|---|---|
| Devices | iPhone (home-screen web app) and Mac (browser), synced |
| Game style | Pet companion (Finch / Tamagotchi style) |
| Missed days | **Real stakes**: the pet can run away and has to be rescued |
| Nutrition goal | **Build muscle**: protein first, moderate calorie surplus |
| Automatic check-offs | Music Coach → piano, Valorant, Geometry Dash (not Nova) |
| Sync backend | Timo's **Pixel server** (pm2, ngrok static domain) |
| UI language | **English**; food search also matches German names |

**Research findings that shape the design**
- **Food data:** the German national food database **BLS 4.0** has been free since Dec 2025. It covers about 7,140 generic foods and 138 nutrients, with **German and English names**, and lists app development as a permitted use. It ships as `BLS_4_0_Daten_2025_DE.xlsx` from blsdb.de. **Open Food Facts** (ODbL, the v3 API is current, rate-limited, and asks for a custom User-Agent) covers packaged products by barcode. Together they replace Yazio's database for free.
- **Barcode on iPhone:** Safari still ships `BarcodeDetector` switched off, so the app uses **zxing-wasm**, hosted with the app and cached by the service worker. The native API is used whenever it exists.
- **iPhone web-app limits:** push needs iOS 16.4 or later and the app installed to the home screen, and the permission request has to come from a tap. iOS has no scheduled local notifications, so reminders are sent by the server. A web app can't do home-screen widgets or read Apple Health.
- **Habit science:** the median time to form a habit is about 59–66 days (Singh et al. 2024; Lally 66 days, range 18–254). Habits people choose themselves and habits done in the morning stick better. Evolution pacing is tuned so the big evolution lands around day 60.
- **Streaks:** loss aversion works but backfires when a streak breaks. The app uses streak freezes, a "don't miss twice" warning, and **badges that can never be lost**, so long-term motivation doesn't depend only on fear of losing a streak.
- **Valorant:** the unofficial HenrikDev API needs a key, which is free in their Discord. It isn't "production grade", so manual check-off always stays available. **GD:** the GDBrowser profile API needs no login but only shows progress (stars, demons, levels), not time played. **Music Coach** already syncs its sessions (`date`, `startedAt`, `endedAt`) to `server/data/sync-<port>.json` on the Pixel, so the server can read it directly with **no change to Music Coach**.
- **ngrok free** puts a warning page in front of browser *HTML* traffic but not API calls. The API therefore uses only CORS "simple" requests (POST with a `text/plain` JSON body and the token inside the body). That avoids preflight requests and the warning page altogether.

## Architecture

```
iPhone (home-screen app) ─┐                         ┌─ Music Coach sync-*.json (same phone)
Mac (browser)  ───────────┼─ GitHub Pages (static) ─┤
                          │   stable HTTPS origin   │
     IndexedDB (Dexie) ◄──┘                         │
     local-first, offline                           ▼
          │  POST /habits/api/*  (ngrok static domain → edge-proxy → :3040)
          └──────────────────────────► habits-api (Pixel, pm2, node:sqlite)
                                         ├─ sync (last write wins, cursor)
                                         ├─ Open Food Facts proxy + cache
                                         ├─ auto-checks every 30 min (HenrikDev, GDBrowser, Music Coach)
                                         └─ Web Push reminders (VAPID)
```

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4 + react-router + **Dexie** (+ dexie-react-hooks) + **vite-plugin-pwa** + **zxing-wasm** + **MiniSearch** (fuzzy search over DE/EN food names) + vitest/fake-indexeddb. This is the same stack and conventions as Music Coach. Charts, rings and the pet are hand-made SVG with no chart library.
- **Hosting:** the static app goes on **GitHub Pages**, deployed by a GitHub Actions workflow. An installed web app's data belongs to its web address, so it needs one that never changes. Cloudflare quick-tunnel addresses change on every restart, which would wipe the iPhone data, and the ngrok warning page breaks an installed app.
- **Server:** `server/` is TypeScript bundled by esbuild into one `server/dist/index.mjs` with no runtime dependencies except `web-push`. It uses the built-in `node:sqlite` because native modules are painful on Termux; a JSON-file store is the fallback if `node:sqlite` turns out to be missing. It **imports the same game engine** as the client so reminders know the pet's real state.
- **Sync model:** every synced record has a string id (ULID), `updatedAt`, `deleted` (a deletion marker) and `deviceId`. `POST /sync {token, since, changes}` merges by "newest `updatedAt` wins", stores a running `seq` number, and returns everything changed after `since`. Sync runs when the app opens or regains focus, after each write (debounced), and on a periodic timer.
- **Game state is never stored. It is always recomputed** from the logs (habit logs, food logs, purchases, vacations) by a pure `replay(days, rules)` function, with a local cache. Two devices can't conflict over XP or HP, and retuning the numbers simply recomputes everything.

## Data model (Dexie, `src/db/db.ts`)

All tables are synced unless marked otherwise.

- `habits`: name, icon, category (`music|gaming|body|mind|other`), kind (`check|count|duration`), target and unit, schedule (`daily | weekdays[] | perWeek n`), difficulty (`easy|medium|hard`), `autoSource?` (`musicCoach|valorant|geometryDash`), order, archived
- `habitLogs`: habitId, `day` (logical date), value, source (`manual|musicCoach|valorant|geometryDash`), createdAt. Auto-check entries use fixed ids (`auto:valorant:<habitId>:<day>`) so re-runs never duplicate.
- `foods`: `off:<barcode>` (cached) and `custom:<ulid>`, each with name/brand, per-100 g values (kcal, protein, carbs, fat, fiber, sugar, salt) and `servings[]`. **BLS foods are a static file (`public/data/foods-bls.json`) and are not synced.**
- `recipes`: name, items `{foodId, grams}[]`, servings
- `foodLogs`: day, meal (`breakfast|lunch|dinner|snack`), foodId/recipeId, grams, and a **copy of the nutrient values** so editing a food later doesn't change history
- `weights` (day, kg) · `rewards` (custom real-life rewards: name, cost) · `purchases` (itemId, cost, day) · `vacations` (from, to) · `settings` (profile, targets, rules options)
- Local only: `meta` (sync token, deviceId, cursor), `gameCache`. Read-only from the server: `integrationStats` (Valorant rank/RR, GD stars and demons per day, for stats charts).

**Logical day:** a day starts at **04:00** (adjustable), so a late-night Valorant session counts for that evening. Logs can be added or edited for **today and yesterday**; anything older is locked for game purposes.

## Game rules (one tunable file, `src/core/game/rules.ts`)

- **Day score** = done ÷ due, weighted by difficulty (easy 1, medium 2, hard 3), over the habits due that day **plus nutrition goals**: "Protein ≥ 90% of target" and "Logged at least 2 meals" (optional: "Calories ≥ 90%"). Bulking never penalises going *over*.
- **XP and coins:** each completed habit gives 10/20/30 XP and half that in coins 🪙. Completing the whole day gives a **random find** (an item, a cosmetic or bonus coins) as a variable reward.
- **Pet HP (0–100), settled when the day ends:** score ≥ 0.8 → +10 · 0.5–0.8 → 0 · 0.2–0.5 → −10 · < 0.2 → −20. A **streak freeze** is used automatically on a day below 0.5 and cancels the HP loss and the streak break. You earn one freeze per 7-day streak, can hold at most 2, and can also buy them in the shop.
- **Real stakes:** at 0 HP the pet **runs away to the forest**. A **rescue quest** (3 consecutive days ≥ 0.8) brings it back at 50 HP, **one evolution stage lower**. Badges and cosmetics are never lost. **Vacation/sick mode** pauses everything so illness or holidays don't count against you.
- **Evolution** (by bond XP; full completion is roughly 60–80 XP a day): Egg → hatch at 100 → 1 tail at 500 (about 1 week) → 3 tails at 1,500 (about 3 weeks) → 5 tails at 3,500 (**about 60 days**, the habit-formation median) → 9-tailed legend at 8,000.
- **Mood** comes from HP and today's progress (happy, content, sad, sleepy, sick, plus "away"). CSS animations show it: idle bobbing, blinking, drooping, and zzz.
- **Streaks:** an overall day streak (score ≥ 0.5) and a streak per habit. A "don't miss twice" warning appears after one miss.
- **Habit strength** per habit: an exponentially smoothed score (like Loop Habit Tracker) showing progress toward "automatic".
- **Shop:** streak freezes, pet cosmetics (hats, backgrounds, colours) and **custom real-life rewards** Timo sets himself (for example "order pizza – 600 🪙").
- **Badges** (permanent): first week, 30/66/100 days, protein streaks, "comeback" (rescued the pet), per-category milestones.

## Nutrition

- **Targets** (`src/core/nutrition/targets.ts`): onboarding asks age, sex, height, weight and activity level. Calories = Mifflin–St Jeor × activity factor **+ 250 kcal** (lean bulk). Protein = **1.8 g/kg**, with 1.6–2.2 shown as the range. Fat = 25% of calories, carbs = the rest. Every target can be edited and is labelled as an estimate. The **weight log** shows a 7-day average trend and suggests ±100 kcal if weekly gain is outside 0.1–0.5 kg.
- **Food search:** MiniSearch over BLS (DE and EN names) + cached Open Food Facts products + custom foods + recipes, with prefix and typo tolerance. "Search online" (Open Food Facts text search) is a separate button because of OFF's rate limit. Recent foods, favourites and "copy yesterday's meal" are included.
- **Barcode:** camera → zxing-wasm (native `BarcodeDetector` when available) → server OFF proxy (sets the User-Agent, caches results for all devices) → direct OFF call if the server is down. Unknown products open a quick form to create a custom food from the label.
- **Portions:** grams/ml everywhere, OFF serving sizes, and a small hand-picked table for staples (1 egg, 1 banana, 1 slice of bread, and so on).
- **Diary screen:** a calorie ring, a **big protein bar**, macro bars, meal sections and a 7-day protein chart. Water is a built-in "count" habit.
- **Build script** `scripts/build-food-db.mjs`: reads the BLS xlsx with exceljs and writes a compact `public/data/foods-bls.json` (code, de, en and the 7 values per 100 g). The nutrient column codes are checked against the file during implementation. The About screen credits BLS, Open Food Facts (ODbL) and USDA if used.

## Auto-checks (server, every 30 min, `server/integrations/`)

- **Music Coach** (`musicCoach.ts`): reads `sync-<port>.json` from the Music Coach folder on the Pixel and adds up `endedAt − startedAt` for the logical day. The piano habit is completed when minutes ≥ its target. The JSON layout is checked on the server first.
- **Valorant** (`valorant.ts`): HenrikDev match list for the Riot ID and region `eu`. Any match started inside the logical day completes the habit, and the match count is stored, so "play 2 games" also works. Rank and RR go to `integrationStats`. The key lives in the server `.env`.
- **Geometry Dash** (`geometryDash.ts`): a daily GDBrowser profile snapshot. **Any** gain in stars, demons or moons completes the habit; otherwise Timo taps it manually. Progress charts come from the snapshots.
- Each integration fails safely: an error is logged with the raw response, the habit stays tappable, and a status dot on the Settings → Integrations screen shows the problem.

## Repo layout (new, in `Habits Tracker/`)

```
CLAUDE.md, README.md, package.json, vite.config.ts, index.html, .claude/launch.json
.github/workflows/pages.yml
scripts/build-food-db.mjs
public/ (icons, apple-touch-icon, data/foods-bls.json, zxing wasm)
src/core/  date.ts · game/{rules,engine,pet}.ts · habits/{schedule,strength}.ts
           nutrition/{targets,search,off,barcode,portions}.ts · sync/{client,protocol}.ts
src/db/db.ts
src/features/ today · habits · food · pet (PetView SVG, shop, badges) · stats · settings · onboarding
src/components/ Ring, ProgressBar, Heatmap, Sheet, ...
server/ index.ts · store.ts (node:sqlite) · sync.ts · off.ts · push.ts · scheduler.ts · integrations/*
```
Tests sit next to their modules (`*.test.ts`), as in Music Coach.

## Phases (each one ends usable)

1. **Base, habits and pet (local only).** Project scaffold, web-app setup (manifest, iOS meta tags, safe areas, `navigator.storage.persist()`), sync-ready Dexie schema, habit create/edit with schedules, Today screen (pet card + habit list + check-off with an animation), game engine with tests, PetView with 5 stages and moods, run-away/rescue, freezes, vacation mode, history heatmap, a basic shop (freezes + real-life rewards), a **dev time-travel panel** for testing, and JSON export/import as a backup. Deploy to GitHub Pages so it **runs on the iPhone straight away** (local data).
2. **Nutrition.** BLS build script and import, profile and target setup, food search, diary, portions, custom foods and recipes, barcode scanner, OFF lookups (direct for now), weight log, and nutrition goals feeding into the day score.
3. **Server and sync.** `habits-api` on the Pixel (port 3040, pm2), sync endpoint, OFF proxy, a `/habits/*` route in edge-proxy, a **heal.sh probe line**, `.env` (chmod 600), and pairing in the app (paste the token or scan a QR code). Migrate the local iPhone data up and confirm the Mac sees it. Update the **Pixel Server `CLAUDE.md`** (services table, port, pitfalls).
4. **Auto-checks.** Music Coach, Valorant and GD integrations, integration status in Settings, and Valorant rank and GD progress charts on the habit pages.
5. **Polish and reminders.** Web Push (VAPID) with an evening reminder, "your pet is weak" alerts, a morning nudge (optional, quiet 22:00–08:00), pet cosmetics, badges, a weekly recap screen, and fine-tuning the balance from real usage.

## Things Timo provides along the way
- Permission to download the BLS 4.0 xlsx from blsdb.de (Phase 2).
- Whether the GitHub repo may be **public**. Free Pages hosting needs that; the code contains no personal data or secrets (Phase 1 deploy).
- Riot ID (name#tag) and a HenrikDev Basic key from their Discord, plus his GD username (Phase 4).
- Which Music Coach instance is his (5173 or 5174) (Phase 4).

## Verification
- **Unit tests (vitest):** engine (HP changes, auto-freeze, run-away at 0 HP, rescue after 3 days with stage −1, evolution thresholds, streaks, vacation pause, edit window), schedule (weekdays, n-per-week, the 04:00 boundary), targets (Mifflin–St Jeor checked against known values), sync merge (newest wins, deletions, idempotent auto-check ids), BLS import sanity checks (chicken breast ≈ 23 g protein per 100 g, oats ≈ 13 g), and zxing decoding a sample EAN image in Node.
- **In the browser** (`.claude/launch.json` preview): onboarding → add piano, Valorant and GD habits → check them off → log a meal → **time-travel** through bad days to watch the pet weaken, run away and get rescued → reload offline.
- **Server:** curl `/sync` from the Pages origin and confirm there is no preflight; two-device sync test (preview tab + Chrome); on the Pixel check `pm2 logs habits-api` for proof the new code is live, a public curl through ngrok, and heal.sh restarting a frozen `habits-api`.
- **iPhone:** install from the Pages URL, scan a real product, log in airplane mode and watch it sync afterwards, and receive a test push.

## Later ideas (not in scope)
AI photo or text food logging through Nova on Discord; exporting the day summary to the Notion "Täglicher Log"; a native wrapper (Capacitor) for widgets and Apple Health, which would need a full Xcode install (only the Command Line Tools are installed now).
