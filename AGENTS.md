# Klimb — Agent Handoff / Project Guide

This file tells an AI coding agent (Codex, Claude, etc.) everything it needs to
work on **Klimb** the way the owner expects: make the change, verify it builds,
apply any database changes, then hand back the exact terminal commands the owner
runs to ship a new build.

Owner: Nick (nickyocom09@gmail.com). Stage: early MVP, actively building, shipping
to TestFlight.

---

## 1. What Klimb is

Klimb is a personal climbing **logbook** app for indoor rock-climbing gyms. A
climber logs a boulder or rope climb — photo, grade, outcome (flash / send /
topped / project) — and it lives in their permanent logbook with stats, a weekly
recap, projects, and a light social layer (friends, activity feed, sharing).

Think a modern, polished, personal climbing logbook with a social layer — NOT a
community-grading or gym-partnership product.

> Important history: Klimb **used to** have "community grading" (crowd-sourced
> grade voting). That was fully **removed**. Do not reintroduce voting, grade
> consensus, "climbers say," or any crowd aggregation. Each climb shows the
> climber's own grade and, optionally, the gym's posted grade.

---

## 2. Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Native shell:** Capacitor (iOS), shipped to the App Store / TestFlight
- **Backend:** Supabase (Postgres, Auth, Storage, RLS)
- **Deploy to phone:** Fastlane lane `beta` → builds web, `cap sync`, archives,
  uploads to TestFlight

Node + npm. Package manager is plain `npm`.

---

## 3. Repo layout & paths

- Repo root (owner's Mac): `/Users/nickyocom/Desktop/claude website/klimb-web`
  (note the space in "claude website" — always quote the path)
- Source: `src/`
  - `src/pages/` — screens (Sends/logbook, RouteDetail, GymSelect, Onboarding,
    Settings, Stats, Friends, Activity, Notifications, AddRoute, etc.)
  - `src/components/` — shared UI (`ui.tsx` has Button/Input/SlideTabs/ConfirmDialog/…)
  - `src/components/log/` — the log flow (LogScrollForm, LogStepFlow, ClimbTypePicker, RewardOverlay)
  - `src/lib/` — data + logic (supabase client, auth, grades, constants, routes,
    logstats, notifications, friends, share, shareCard, climbShares, database.types.ts)
- iOS project: `ios/App/`
  - Native Capacitor plugins are written directly in `ios/App/App/AppDelegate.swift`
    (InstagramStories, AppleSignIn, MessageCompose). The `.pbxproj` is old-style,
    so adding new native source files is awkward — prefer adding plugin classes
    inside `AppDelegate.swift`.
  - Fastlane: `ios/App/fastlane/Fastfile` (lane `beta`)
  - `ios/App/Gemfile` / `Gemfile.lock` — see deploy quirks below

---

## 4. Supabase

- Project ref: `qanfxjjiegqdmhmgwtxl`
- URL: `https://qanfxjjiegqdmhmgwtxl.supabase.co`
- Publishable (anon) key: `sb_publishable_e8ZnpgqnTG5dZjBvQcI0Vg_cW_QEYeK`
- Storage bucket: `route-photos` (public read; authenticated upload)
- The app reads these from `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  and `VITE_FACEBOOK_APP_ID` for Instagram sharing).
- **Never put the Supabase secret/service key in client code.** Only the
  publishable key ships in the app.

### Applying database changes
If your agent has a Supabase MCP/tool, apply migrations directly. If not, apply
SQL through the **Supabase dashboard → SQL Editor**, or the Supabase CLI, against
project `qanfxjjiegqdmhmgwtxl`. Database changes are **live immediately** and are
independent of the app build — they do NOT require a TestFlight push.

### Core tables
- `profiles` — 1:1 with auth.users. Key fields: `display_name`, `username`,
  `home_gym_id`, `visiting_gym_id`, `grade_system` (`american` | `european`),
  `theme`, `log_style` (`scroll` | `steps`, default `steps`), `sends_public`,
  `projects_public`, `onboarded`, notification markers.
- `gyms` — pre-seeded (users do NOT create gyms; they can "suggest" one which
  inserts a `pending` row). Fields: `name`, `city`, `state`, `country`, `cc`
  (lowercase ISO-2), `latitude`, `longitude`, `status` (`approved` | `pending`),
  `grading_style`.
- `routes` — a logged climb. `photo_url`, `video_url`, `hold_color`,
  `climbing_type` (`boulder` | `toprope` | `lead`), `gym_grade` (int, nullable),
  `status`, `created_by`. NOTE: `wall_section` column still exists but is
  **deprecated/unused** — it was removed from the whole UI; leave it null.
- `grades` — one per user per route (their felt grade, integer ordinal).
- `sends` — one per user per route. `send_type` (`flash` | `send` | `topped` | `attempt`).
- `bookmarks` — `kind` (`project` | `favorite`).
- `comments`, `route_ratings`, `gone_reports`, `route_reports`, `content_reports`,
  `blocks`, `friendships` (`status` pending/accepted), `recaps`, `project_notes`.
- `climb_shares` — in-app "send a climb to a friend": `route_id`, `from_user`,
  `to_user`, `message`. Surfaced on the recipient side via the derived
  notifications feed.

### RLS conventions
Public can read gyms/routes/grades/sends/comments. Authenticated users insert;
users update/delete only their own rows. `bookmarks` project visibility is gated
on `profiles.projects_public`. Functions like `delete_account()` must have
`GRANT EXECUTE ... TO authenticated`.

---

## 5. Grades

Grades are stored as an **integer ordinal** into the climbing-type scale and
rendered per grade system:
- Boulder → 0..17 = V0..V17
- Rope (top rope AND lead) → 0..28 = 5.5..5.15d (YDS). Lead shares the rope scale.

Two grade systems, chosen in Settings:
- **American** (default) — V-scale / YDS
- **"International"** — Font (boulder) / French (rope). **The stored value is
  still the string `european`** for back-compat; only the UI label says
  "International." Don't migrate the stored value.

Climbing type is presented as two umbrellas in the log flow: **Boulder** (no rope)
vs **Rope**, and Rope reveals a **Top Rope / Lead** sub-choice.

Grade helpers live in `src/lib/grades.ts` (`formatGrade`, `pickerOptions`,
`gymGradeOptions`, `isRope`). Boulder V-grades display as "V4"; rope as "5.10a".

---

## 6. Feature state (current)

Built: email + Apple + Google auth (Apple is fully native, no browser bounce);
guest mode (app opens without login; login only when you tap Log); onboarding
(name → home gym → log-style); gym browse/search (USA listed first, drill-in
resets scroll, "suggest a gym"); the log flow in two switchable styles
(single-scroll vs one-question-at-a-time steps); projects with journal notes;
weekly recap (story-style, shareable card); stats; friends (request/accept/deny,
block, QR add); gym activity feed; derived in-app notifications; per-climb sharing
(branded card → Instagram / Messages / OS share sheet / send to a Klimb friend);
home-gym radius lock (must be within ~25 mi to set home gym; ~50 mi to add a route);
delete account.

Deferred / not yet: worldwide gym globe/map (placeholder until DB is big);
follow-graph beyond gym activity; AI route ID from photos; monetization; push
notifications.

**Manual step before real launch:** re-enable email confirmation in the Supabase
Auth dashboard (it's off for testing).

---

## 7. Design conventions

- Dark theme is the default; light mode in Settings. Never remove the dark default.
- Accent color is a PS5-style **silver** (CSS vars `--c-accent` / `--c-accent-dim`
  in `src/index.css`, consumed via Tailwind's `accent` color).
- Prominent photos; the climber's grade is the biggest element on a card.
- Animations: fade-up on lists, scale-in on modals. Bottom nav (Spotify-shaped):
  Home/Logbook, Gyms, Add, Activity, Profile.
- Keep formatting/logic minimal and consistent with existing components.

## 8. What NOT to do
- Don't reintroduce community grading / grade voting / "climbers say."
- Don't add gym partnerships or let users create gym pages (suggest-only).
- Don't remove the dark-theme default or the silver accent.
- Don't build the globe/map yet (placeholder only). No push notifications yet.
  No monetization yet.
- Don't expose the Supabase secret key in client code.
- Don't re-add the wall-section UI.

---

## 9. The workflow (do this for every task)

1. **Make the code change** in `src/` (and `ios/App/App/AppDelegate.swift` for
   native bits).
2. **Apply any DB change** to Supabase project `qanfxjjiegqdmhmgwtxl` (dashboard
   SQL editor / CLI / MCP). Remember: DB changes are live instantly, app-code
   changes are not.
3. **Verify it builds — always.** From the repo root:
   ```
   npm install        # first time / after dependency changes
   npx tsc -b         # MUST be clean — fix every TypeScript error
   npm run build      # runs tsc -b && vite build
   ```
   Do not consider a task done until `tsc -b` is clean and `vite build` succeeds.
4. **Hand the owner the deploy commands** (below). The owner runs them in their
   Mac terminal; TestFlight updates automatically.

---

## 10. Deploy / push (owner runs these on the Mac)

```
cd "/Users/nickyocom/Desktop/claude website/klimb-web"
rm -f .git/index.lock
git add -A
git commit -m "<describe the change>"
git push origin main
cd ios/App && bundle exec fastlane beta
```

What happens:
- `rm -f .git/index.lock` clears a stale git lock that recurs on this machine.
- git add/commit/push saves to GitHub.
- `bundle exec fastlane beta` builds the web app, runs `cap sync ios`, bumps the
  build number, archives, and uploads to TestFlight. It builds **whatever is on
  disk**, so the commit isn't strictly required for the build — but commit anyway.
- After upload, TestFlight takes ~5–15 min to process before the new build shows
  on the phone.

### Mac-specific gotchas (important — this machine has quirks)
- System Ruby is **2.6.10**. `Gemfile.lock` must keep `BUNDLED WITH` at
  **2.4.22** (newer Bundler needs Ruby ≥ 3.2). If bundler is missing:
  `sudo /usr/bin/gem install bundler -v 2.4.22` (use the explicit `/usr/bin/gem`
  path — a bare `gem` sometimes resolves to a different Ruby).
- If `git commit` fails on a lock file, run `rm -f .git/index.lock` and retry.
- Only run ONE `fastlane beta` at a time. If a build is already running in the
  terminal, don't paste more commands — they just queue and jam the shell. Wait
  for the `%` prompt and `fastlane.tools finished successfully 🎉`.
- If TestFlight "doesn't update," it's almost always (a) the build is still
  processing, or (b) the change was DB-only (already live) vs app-code (needs a
  build). Distinguish the two before re-running.

---

## 11. Environment (.env, not committed)
```
VITE_SUPABASE_URL=https://qanfxjjiegqdmhmgwtxl.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_e8ZnpgqnTG5dZjBvQcI0Vg_cW_QEYeK
VITE_FACEBOOK_APP_ID=1057669103865351
```
`VITE_FACEBOOK_APP_ID` is only used for the one-tap Instagram Stories share; if
blank, sharing falls back to the OS share sheet.
