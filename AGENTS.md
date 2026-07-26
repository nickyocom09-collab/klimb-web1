# Klimb — Agent Handoff & Full Project Context

You (the AI agent, e.g. Codex) are taking over development of **Klimb**, an iOS
climbing-logbook app that is almost ready for its first App Store review. This
file is your complete brief: what the app is, how the code is laid out, how to
build/verify/ship it, the current state, and what's left. Read it fully before
making changes.

Owner: Nick (contact: realklimb@gmail.com; Apple ID / dev account: nickyocom09@gmail.com).

---

## 0. How you should work (important)

- You run on the owner's Mac with a real shell. Run commands directly in the
  repo (`npm`, `npx tsc -b`, `git`, `bundle exec fastlane`). Use absolute paths;
  the repo path contains a space, so **always quote it**.
- **Always verify before finishing a task:** run `npx tsc -b` (must be clean —
  the project uses `noUnusedLocals`/`noUnusedParameters`, so unused imports fail
  the build) and `npm run build`. Never call a task done until both pass.
- After code changes, tell the owner the git + Fastlane commands to ship (below).
  The owner runs the build; TestFlight updates automatically.
- **Database changes are applied to Supabase directly** (see §4). They are live
  immediately and are independent of the app build. Native/JS code changes only
  reach the phone through a new TestFlight build.
- Use a task list for multi-step work. Ask the owner before big ambiguous work.

---

## 1. What Klimb is

A **personal climbing logbook** for indoor gyms. A climber logs a boulder or rope
climb — photo, grade, outcome (flash / sent / topped / project) — and it lives in
their permanent logbook with stats, a weekly recap, projects, friends, and
sharing. Polished, dark, personal. NOT a community-grading or gym-partnership app.

> HARD RULE: Community grading (crowd grade voting, "climbers say", consensus)
> was fully removed. Do not reintroduce it. Each climb shows the climber's own
> grade and, optionally, the gym's posted grade.

---

## 2. Tech stack

- Frontend: React 19 + Vite + TypeScript + Tailwind CSS 3
- Native shell: Capacitor 8 (iOS), shipped via TestFlight
- Backend: Supabase (Postgres, Auth, Storage, RLS)
- Deploy: Fastlane lane `beta` (`ios/App/fastlane/Fastfile`)
- Capacitor plugins in use: `@capacitor/app`, `browser`, `camera`, `filesystem`,
  `share`, plus three custom native plugins (see §7).

---

## 3. Repo layout & paths

- **App repo (do your work here):** `/Users/nickyocom/Desktop/claude website/klimb-web`
- There is a second Finder folder `/Users/nickyocom/Desktop/Klimb` that holds an
  older `CLAUDE.md` project bible — treat THIS file (AGENTS.md in klimb-web) as
  the source of truth; the old one is stale.
- `src/pages/` — screens (Sends=Logbook/home, RouteDetail, ProjectDetail,
  GymSelect, GymMap, Gyms, Onboarding, Settings, Stats, Friends, Activity,
  Notifications, AddRoute, Login, Signup, GuestHome, ForgotPassword,
  ResetPassword, Passport, Profile, PublicProfile, FullLogbook, Glossary…).
- `src/components/` — shared UI. `ui.tsx` has Button, Input, **PasswordInput**
  (eye toggle), Textarea, SlideTabs, ConfirmDialog, Spinner, etc.
- `src/components/log/` — the log flow: LogScrollForm, LogStepFlow,
  ClimbTypePicker, RewardOverlay, outcomeIcon.
- `src/lib/` — data + logic: `supabase.ts` (client), `auth.tsx` (AuthProvider),
  `deeplink.ts` (OAuth/email deep links), `grades.ts`, `constants.ts`,
  `routes.ts`, `logstats.ts`, `recaps.ts`, `notifications.ts`, `friends.ts`,
  `climbShares.ts`, `share.ts`, `shareCard.ts`, `photo.ts`, `location.ts`,
  `moderation.ts`, `bookmarks.ts`, `database.types.ts` (hand-written DB types).
- iOS project: `ios/App/`
  - `App/AppDelegate.swift` — contains the custom native plugins AND
    `MainViewController` (the bridge subclass that registers them).
  - `App/Base.lproj/Main.storyboard` — bridge scene points at `MainViewController`.
  - `App/Info.plist` — URL scheme `klimb`, usage strings, IG query scheme.
  - `fastlane/Fastfile` — lane `beta`. `fastlane/.env` (gitignored) holds the App
    Store Connect API key vars: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_FILEPATH`.

---

## 4. Supabase

- Project ref: `qanfxjjiegqdmhmgwtxl` · URL `https://qanfxjjiegqdmhmgwtxl.supabase.co`
- Publishable (anon) key: `sb_publishable_e8ZnpgqnTG5dZjBvQcI0Vg_cW_QEYeK`
- Storage bucket: `route-photos` (public read; authenticated upload).
- App reads env from `.env` (see §12). **Never put the service/secret key in client code.**

**Applying DB changes:** you likely won't have a Supabase MCP. Apply SQL via the
**Supabase dashboard → SQL Editor** (project `qanfxjjiegqdmhmgwtxl`) or the
Supabase CLI. When a task needs a schema/data change, give the owner the exact SQL
to paste, or run it via CLI if configured. DB changes are live instantly.

**Tables:** `profiles` (display_name, username, home_gym_id, visiting_gym_id,
grade_system `american|european`, theme, log_style `scroll|steps` (default steps),
sends_public, projects_public, onboarded, seen_intro, notification markers),
`gyms` (name, city, state, country, cc lowercase ISO-2, latitude, longitude,
status `approved|pending`, grading_style), `routes` (photo_url, video_url,
hold_color, climbing_type `boulder|toprope|lead`, gym_grade int nullable,
created_by, status; NOTE `wall_section` column is DEPRECATED/unused — removed from
UI, leave null), `grades` (one per user/route, integer ordinal), `sends`
(send_type `flash|send|topped|attempt`), `bookmarks` (kind `project|favorite`),
`comments`, `route_ratings`, `gone_reports`, `route_reports`, `content_reports`,
`blocks`, `friendships` (status pending/accepted), `recaps`, `project_notes`,
`climb_shares` (route_id, from_user, to_user, message — in-app "send climb to a
friend", surfaced via the notifications feed).

**Key DB functions:** `generate_recaps(period)` (builds the weekly/monthly recap
payload — includes boulder/toprope/lead hardest sends + type_counts),
`delete_account()` (has EXECUTE granted to authenticated), `set_gym_grade(...)`.

**RLS:** public read on gyms/routes/grades/sends/comments; users insert; users
update/delete only their own rows. `climb_shares` visible to from_user/to_user
only. `bookmarks` project visibility gated on `profiles.projects_public`.

---

## 5. Grades & climb types

Grades are stored as an integer ordinal per scale and rendered per system:
- Boulder → 0..17 = V0..V17
- Rope (top rope AND lead) → 0..28 = 5.5..5.15d (YDS). Lead shares the rope scale.

Two systems in Settings: **American** (V/YDS, default) and **"International"** —
BUT the stored value is still the string `european` for back-compat; only the UI
label says "International." Don't migrate the stored value.

Climb type is two umbrellas: **Boulder** (no rope) vs **Rope**, and Rope reveals
**Top Rope / Lead** (`ClimbTypePicker`). Helpers in `grades.ts`: `formatGrade`,
`pickerOptions`, `gymGradeOptions`, `isRope`. `constants.ts`: `isRopeType`,
`climbTypeLabel`, `CLIMB_TYPES`, `CLIMB_FILTERS`.

---

## 6. Auth & deep links (how sign-in works)

- Client (`supabase.ts`) uses **`flowType: "pkce"`** — required for reliable
  mobile deep-link OAuth (implicit `#hash` was causing Google to spin forever).
- `deeplink.ts` `setupDeepLinks()` listens for `appUrlOpen` on `klimb://` and
  either `setSession` (email confirm/recovery hash tokens) or
  `exchangeCodeForSession(code)` (PKCE OAuth), then `Browser.close()`.
- `auth.tsx` `signInWithProvider`:
  - Apple on iOS: tries the native `AppleSignIn` plugin first; if it's
    unavailable ("not implemented") it falls back to the OAuth browser flow.
  - Google (and Apple fallback) on native: `signInWithOAuth({ skipBrowserRedirect
    })` then `Browser.open(url)` — do NOT let supabase navigate the app's own
    WebView (that tears down the React app).
  - Web: normal full-page redirect.
- Supabase Auth → URL Configuration must allow `klimb://auth-callback` (exact) —
  already added. Google/Apple providers configured in Supabase dashboard.
- **Email confirmation is currently OFF** in Supabase (for testing). Re-enable it
  before public launch.

---

## 7. Custom native plugins (Swift, in `AppDelegate.swift`)

Three plugins, each `@objc(...) public class ...: CAPPlugin, CAPBridgedPlugin`:
- `AppleSignInPlugin` (jsName `AppleSignIn`) — native Sign in with Apple.
- `InstagramStoriesPlugin` (jsName `InstagramStories`) — one-tap share to IG Story.
- `MessageComposePlugin` (jsName `MessageCompose`) — native iMessage compose.

Capacitor's auto-discovery was NOT registering these app-target plugins (symptom:
JS error "<Plugin> not implemented on iOS"). Fixed by a bridge subclass
`MainViewController: CAPBridgeViewController` (in AppDelegate.swift) that
registers each in `capacitorDidLoad()` via `bridge?.registerPluginInstance(...)`,
and `Main.storyboard`'s bridge scene now uses `customClass="MainViewController"
customModule="App"`. If you add a new local plugin, register it there too.

Info.plist already has: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`,
`NSPhotoLibraryAddUsageDescription`, `NSLocationWhenInUseUsageDescription`,
`LSApplicationQueriesSchemes: instagram-stories`, and the `klimb` URL scheme.

---

## 8. Feature state (current)

Built & working in code: email/Apple/Google auth; guest mode (browse without
login; login only when logging); first-launch welcome tutorial (`IntroTutorial`,
gated by localStorage `INTRO_SEEN_KEY` for guests + `profiles.seen_intro` for
signed-in); onboarding (name → home gym → log style); gym browse/search (USA
first, scroll resets on drill-in, suggest-a-gym); dual log flow (single-scroll vs
one-question steps, default steps); **native photo capture** (camera/library
prompt via `@capacitor/camera`, `useLogClimb.pickPhoto`) + **edit/replace photo**
on an existing climb (LogSheet header, tap to change); projects w/ journal notes;
weekly recap (story-style, boulder/TR/lead hardest sends + "what you climbed"
mix, one-tap IG Story + Messages + OS share); stats (grade pyramid, streaks,
hardest sends split by discipline); friends (request/accept/deny, block, QR add);
gym activity feed; in-app notifications (incl. climb shares); **per-climb sharing**
(branded card → IG/Messages/OS sheet/send-to-friend); Settings (theme, grade
system, log style, privacy split sends/projects, blocked list, **change email**,
delete account); home-gym radius anti-cheat (see §9).

Design: dark default (never remove), **silver PS5-style accent** (CSS vars
`--c-accent`/`--c-accent-dim` in `src/index.css`), prominent photos, Spotify-shape
bottom nav with **liquid-glass** styling, fade-up/scale-in animations.

Deferred / do NOT build yet: worldwide gym globe (placeholder), follow-graph
beyond gym activity, AI route ID, push notifications, monetization.

---

## 9. Location / anti-cheat (don't weaken without asking)

`location.ts` `assertNearGym()` **fails closed**: no gym coordinates, no device
location, or >25 mi away → blocked. It's enforced when setting a home gym
(GymSelect, GymMap, Gyms.tsx), starting a visiting gym (GymMap), logging a climb
(`useLogClimb.save`), and adding a route (AddRoute). All 423 gyms have coords.
NOTE for App Review: a reviewer must be near a real gym (or set device location to
a city that has one) to log — this is called out in the review notes.

---

## 10. Build, verify, deploy

Verify (in repo root):
```
npm install        # first time / after dep changes
npx tsc -b         # MUST be clean
npm run build      # tsc -b && vite build
```

Ship a TestFlight build:
```
cd "/Users/nickyocom/Desktop/claude website/klimb-web"
rm -f .git/index.lock                 # clears a stale lock this machine hits
git add -A
git commit -m "…"
git push origin main
cd ios/App && bundle exec fastlane beta
```
`fastlane beta` builds web → `cap sync ios` → bumps build number → archives →
uploads to TestFlight. TestFlight takes ~5–15 min to process after upload.

**Mac gotchas (this machine):**
- System Ruby 2.6.10. `ios/App/Gemfile.lock` must keep `BUNDLED WITH` = `2.4.22`.
  If bundler is missing: `sudo /usr/bin/gem install bundler -v 2.4.22` (use the
  explicit `/usr/bin/gem` path).
- Signing: the Fastfile's `build_app` uses `export_options: { signingStyle:
  "automatic" }` + `xcargs: "-allowProvisioningUpdates"`. This fixed the
  "No signing certificate 'iOS Distribution' found" export error. The account has
  a valid "Apple Distribution" cert and paid Developer Program (team "Nick Yocom",
  Admin). Don't switch export back to manual.
- Only run ONE `fastlane beta` at a time; don't paste commands while it runs.
- If TestFlight "doesn't update": either it's still processing, or the change was
  DB-only (already live) vs app-code (needs a build).

---

## 11. App Store submission status (first review, in progress)

- Bundle id `com.nickyocom.klimb`; app name Klimb; Version `1.0`; Copyright
  `2026 Nick Yocom`; Manual release chosen.
- Support/Privacy pages: hosted at `https://klimbsupport.netlify.app/`. Root
  serves Support. The privacy page must be re-deployed from the repo folder
  `klimb-site/` (contains `index.html` = support, `privacy.html` = privacy) so
  `https://klimbsupport.netlify.app/privacy.html` is live. (There are also copies
  in `public/` that deploy with the web app.) Contact email on both: realklimb@gmail.com.
  - Support URL (version page): `https://klimbsupport.netlify.app/`
  - Privacy Policy URL (App Information page): `https://klimbsupport.netlify.app/privacy.html`
- Keywords: `climbing,bouldering,rock climbing,climbing log,logbook,lead,top rope,send,grades,tracker,projects`
- Marketing URL: optional (a public Instagram link is fine, else blank).
- App Review notes must include a demo account (create one; email confirmation is
  off so it works instantly) AND explain the location gate (reviewer must be near
  a gym / set device location to a city with one).
- STILL TODO before submit: screenshots (required), finish App Privacy data-
  collection questionnaire, re-deploy the privacy page, submit.

---

## 12. Environment (`.env`, gitignored)
```
VITE_SUPABASE_URL=https://qanfxjjiegqdmhmgwtxl.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_e8ZnpgqnTG5dZjBvQcI0Vg_cW_QEYeK
VITE_FACEBOOK_APP_ID=1057669103865351
```
`VITE_FACEBOOK_APP_ID` is only for the one-tap Instagram Story share; blank →
falls back to the OS share sheet.

---

## 13. Open TODOs / next tasks

1. **Add more gyms** the owner will provide (name, city, state/region, country).
   Insert with correct `cc` (lowercase ISO-2), `country`, `latitude`, `longitude`,
   `status='approved'`. The passport (`Passport.tsx`) is dynamic — it lists every
   country that has gyms and unlocks one when the user logs there. For any BRAND-
   NEW country code, add it to the `CONTINENT` map in `Passport.tsx` so it files
   under the right continent instead of "Elsewhere."
2. Verify on a fresh TestFlight build: Apple sign-in (native sheet, not "not
   implemented"), Google (completes, no spin), one-tap Instagram Story, native
   camera, edit-photo, change-email, password confirm/eye.
3. Re-enable email confirmation in Supabase Auth before public launch.
4. App Store: screenshots, App Privacy questionnaire, submit.

---

## 14. What NOT to do
- Don't reintroduce community grading / grade voting.
- Don't weaken the location anti-cheat without asking.
- Don't remove the dark-theme default or the silver accent.
- Don't re-add the wall-section UI.
- Don't build the globe/map, push notifications, or monetization yet.
- Don't put the Supabase service key in client code.
- Don't switch Fastlane export back to manual signing.
