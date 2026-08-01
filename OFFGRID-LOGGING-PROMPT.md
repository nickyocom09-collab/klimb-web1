# Feature prompt: "Log without a gym, transfer later" (Off-grid logging)

## Goal
Some climbers open Klimb and their gym isn't in the directory yet. Today they're
stuck: the app forces a home gym before it lets you in, and every logged climb
requires a real `gym_id`. Build an escape hatch:

1. At the "choose your gym" step, a climber who can't find their gym can choose to
   **start logging anyway** into a personal, gym-less log ("off-grid" climbs).
2. They keep logging climbs normally; the climbs are saved to *them*, not to any
   gym, and stay private.
3. When their gym later gets added to Klimb (they can suggest it in the same
   flow), the app offers to **transfer** their off-grid climbs into that gym so
   they become normal logged climbs there — with their original dates intact.

The feature must be explained clearly to the user at each step, and the UI must
look clean and match the existing app (dark-first, rounded-2xl cards, `accent`
highlights, `animate-fade-up` / `animate-fade-in`, the `Button`/`Input` from
`components/ui.tsx`).

## Read these files first
- `src/pages/GymSelect.tsx` — the gym picker + existing "Suggest a gym" sheet. This
  is where the entry point goes.
- `src/App.tsx` — routing gates. Line ~63: `if (profile && !profile.home_gym_id)
  return <Navigate to="/gym/select" replace />;` This gate currently makes a
  gym-less user impossible; it must learn about off-grid mode.
- `src/lib/useLogClimb.ts` — the single save path. `gymId =
  visiting_gym_id ?? home_gym_id`; save() calls the `log_climb` RPC and enforces
  `assertNearGym` (proximity anti-cheat). Off-grid logging needs a parallel path
  that skips the gym requirement and the proximity check.
- `src/components/log/LogStepFlow.tsx` and `LogScrollForm.tsx` — the two log
  presentations. Reuse these; only the destination of the save changes.
- `src/pages/Profile.tsx` and `src/pages/Sends.tsx` — the logbook, where off-grid
  climbs get their own labeled section.
- `CLAUDE.md` — project rules (dark default, grades stored as integers, don't
  touch monetization, run `tsc -b` clean before finishing, etc.).

## Data model (new migration — apply via Supabase MCP, do not hand me raw SQL to paste)
Add a table for gym-less climbs. Mirror the columns `log_climb` writes so a
transfer is a 1:1 mapping. Do NOT hang these off `routes`/`sends` (those require a
`gym_id`) and do NOT create a placeholder gym (it would pollute the map).

```
create table personal_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  gym_label     text,            -- free text gym name the climber typed (what they're waiting on)
  pending_gym_id uuid references gyms(id) on delete set null, -- set if they suggested it and it's pending
  climbing_type climbing_type not null,   -- reuse the existing enum
  hold_color    text not null,
  route_name    text,
  gym_grade     integer,
  felt_grade    integer,
  outcome       text not null,   -- 'flash' | 'send' | 'project'
  stars         integer,
  note          text,
  photo_url     text,
  created_at    timestamptz not null default now(),
  transferred_at timestamptz,    -- set when moved into a real gym
  transferred_route_id uuid references routes(id) on delete set null
);
```

RLS: a user can select/insert/update/delete **only their own** `personal_logs`
rows (`auth.uid() = user_id`). These are private — never exposed in any gym feed,
community grade, or public profile until transferred.

Add one column to `profiles` so the app knows a user deliberately chose off-grid
and shouldn't be bounced to the gym picker forever:

```
alter table profiles add column offgrid_gym_label text; -- non-null => user is in off-grid mode, value is the gym they want
```
(Reuse this to prefill the transfer prompt and the suggest-a-gym name.)

## UX flow

### A. Entry point — in GymSelect "Suggest a gym" sheet
After the climber submits a gym suggestion (the existing `sgDone` success state),
add a clear second action below "Done":

> **Want to start logging now?**
> Your gym isn't on Klimb yet — but you can log climbs to a personal logbook and
> move them over the moment [Gym Name] is added.
>
> `[ Start logging without a gym ]`

Also surface this from the dashed "Don't see your gym? Add it" prompt for climbers
who don't want to fill out a suggestion at all — a lighter "Just let me log for
now" link.

Choosing it: set `profiles.offgrid_gym_label` = the gym name they typed (or a
generic placeholder if none), leave `home_gym_id` null, `refreshProfile()`, and
navigate to `/`. Keep the copy honest and short — one card, no wall of text.

### B. Let off-grid users into the app
In `App.tsx`, change the gate so a user with no `home_gym_id` **but** a non-null
`offgrid_gym_label` is allowed through instead of being redirected to
`/gym/select`. Everything gym-scoped (gym Activity feed, community grades, the map
"log here") should degrade gracefully for these users — show a friendly empty
state prompting them to add/pick their gym, never a crash or a dead screen.

### C. Off-grid logging path
Give the log flow a gym-less mode. When `gymId` is null but the user is off-grid:
- Reuse `LogStepFlow` / `LogScrollForm` exactly — same steps, same look.
- **Skip** `assertNearGym` (there's no gym location to be near).
- On save, insert into `personal_logs` instead of calling the `log_climb` RPC.
- Keep the reward moment (`Flashed!` / `Sent!` / `On the board`) identical.
- Show a small, calm banner at the top of the log screen: "Logging off-grid —
  these save to your personal logbook and can be moved to [Gym Name] later."

The cleanest implementation is to branch inside `useLogClimb.ts`'s `save()` (and
skip the proximity block) based on an `offGrid` flag derived from
`!gymId && !!profile.offgrid_gym_label`, so the two forms need no changes.

### D. Logbook display
In the Profile logbook (and `Sends.tsx`), show off-grid climbs in their own
clearly labeled section — e.g. an "Off-grid" tab or a titled group with a subtle
badge on each card — separated from gym-linked sends. Include one explanatory
line: "Not tied to a gym yet. Transfer them when your gym is added." Off-grid
climbs should still count toward the user's personal totals/streaks (they're real
climbs), but must not appear in any gym's community data.

### E. Transfer flow
Trigger the offer when a real gym for this user becomes available:
- their suggested gym flips to `status='approved'`, or
- they pick/set a home gym from the picker while they have off-grid climbs.

Show a clean prompt (sheet or card):
> **[Gym Name] is on Klimb now.**
> You have **N** climbs logged off-grid. Move them into [Gym Name]?
> `[ Transfer N climbs ]`   `[ Not now ]`

Transfer does, per climb: create the real route + send + grade + rating exactly as
a normal log would (reuse the `log_climb` logic — add a `p_created_at` parameter,
or a dedicated `transfer_personal_log` RPC, so the **original date is preserved**),
**skip the proximity check** (this is historical data, not a live check-in), then
stamp `personal_logs.transferred_at` and `transferred_route_id`. Do it in a
transaction; if any climb fails, roll that one back and report how many moved.
After a full transfer, clear `offgrid_gym_label` and set `home_gym_id`.

Let the user also transfer later from the logbook (a "Transfer to my gym" button on
the off-grid section) in case they tap "Not now."

## Copy & design requirements
- Explain the feature in plain, encouraging language at every touchpoint (entry,
  logging banner, logbook section, transfer prompt). No jargon.
- Match existing components and motion; dark theme first. Reuse `Button`, `Input`,
  the sheet pattern already in `GymSelect.tsx`, and lucide icons already imported.
- V-grades render as "V4", YDS as "5.10a" (use existing grade helpers).

## Constraints (from CLAUDE.md)
- Don't remove the dark default. Don't touch monetization/entitlements.
- Grades are integers converted for display — reuse `lib/grades.ts`.
- Don't build the globe/map beyond what exists.
- Apply DB changes as a Supabase migration.
- Run `tsc -b` and fix ALL TypeScript errors before finishing.

## Acceptance criteria
1. A brand-new user who can't find their gym can enter the app and log climbs
   without ever setting a home gym.
2. Off-grid climbs are private, saved to the user, and shown in a clearly labeled
   logbook section with an explanation.
3. When the user's gym is added (or they pick one), they're offered a one-tap
   transfer that moves the climbs into that gym as normal logged climbs, keeping
   original dates, with no proximity block.
4. Nothing off-grid leaks into any gym's community grades or feed before transfer.
5. `tsc -b` is clean; dark theme and existing UI patterns preserved.
```
