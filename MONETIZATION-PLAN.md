# Klimb Monetization Plan (staged — DO NOT ACTIVATE until Nick says go)

## Status
Klimb launches **100% free**. The entire paywall is **built but dormant**: the
entitlement files are intentionally excluded from the TypeScript build
(`tsconfig.app.json` → `exclude`) and no paywall is mounted. Nothing charges
anyone. This document is the plan to turn it on **later**, plus the founding-member
rules. Keep everything dormant until Nick explicitly approves activation.

## Why free-first is fine (and better)
- Free maximizes early signups, which build the route/grade library and the
  network effect that makes Klimb worth using.
- The subscription plumbing already exists (see "What's already built"), so
  adding paid later is config + activation + an App Store update, not a rewrite.
- Going free→paid is only risky if you **remove** features people already had.
  We don't: all Pro features are additive, and founding members get Pro free.

## Pricing (decided)
- **Monthly:** $3.99 / month
- **Annual:** $34.99 / year (~$2.92/mo; saves $12.89 versus 12 monthly payments)
- **Founding Members:** Pro **free for life** (see rules below)
- **Launch lifetime deal (optional test):** one-time ~$49.99 ("pay once, never pay
  again"), offered only for a **limited window or limited quantity** to create
  urgency and pull in launch cash without permanently capping subscription revenue.
- **7-day free trial for EVERYONE:** every new subscriber gets a 7-day free
  trial before the first charge, on both Monthly and Annual. Implement as an
  Apple **introductory free-trial offer** on the subscription group (Apple allows
  one intro offer per Apple ID per subscription group, so each new subscriber is
  eligible for one 7-day trial). The paywall must clearly say "Try Pro free for 7
  days, then $X" and only charge after the trial unless canceled. Founding members
  don't need the trial (they already have Pro free for life).

## Founding Members (rule: date cutoff)
- **Definition:** any account whose `profiles.created_at` is **before a cutoff date
  Nick chooses**. New signups on/after the date follow the normal free/paid flow.
- **Why date-based:** no per-user tagging needed, and Nick can set the date
  *after* launch (it keys off each account's existing creation date). E.g. decide
  "everyone before Sept 1" or "before we hit 500 users" whenever it feels right.
- **Grant mechanism (server-authoritative):** when resolving a user's entitlement,
  treat `created_at < FOUNDING_CUTOFF` as **lifetime Pro**. Implement this in the
  backend/entitlement resolution (not the client) so it can't be spoofed:
  - Store `FOUNDING_CUTOFF` as a single config value (Supabase table row or edge
    function env var), and
  - either (a) have the entitlement read/`verify-app-store-transaction` flow
    return `lifetime` when the user qualifies, or (b) backfill `user_entitlements`
    with a `lifetime` row for all qualifying users via a one-time migration and a
    trigger for future signups before the cutoff.
  - Founding lifetime must be **non-downgradeable** by subscription reconciliation
    (the code already treats lifetime as authoritative — preserve that).

## Free vs Pro feature breakdown  (CURRENT DRAFT — still being workshopped)
Golden rule: **never paywall the core loop or anything that grows the network.**
Logging climbs, community grades, and comments are why Klimb exists and spreads —
always free. Charge for depth, history, and vanity.

**Hard-free (never gate):** viewing community grades + distribution, comments/beta,
logging climbs (unlimited), and adding routes/photos/video. Gate any of these and
free users have no reason to join, which starves the community that makes Pro worth
buying.

**Decided so far:** move **full logbook history** into Pro (Nick, Aug 2026).

### FREE
- Log climbs — sends, flashes, projects (UNLIMITED — never cap the count)
- Community grading + grade distribution bar
- Route feed, add routes, photos/video, comments & beta
- **Recent logbook only** — see your last ~30 days of sends/projects (window TBD:
  30/60/90 days or "last N sends")
- Basic stats — lifetime totals, this-week numbers
- Friends + gym activity feed
- Current-week **weekly recap** (this is the viral share loop — keep free)
- Gym selection, map, passport

### PRO
- **Full logbook history** — your permanent all-time logbook and progression.
  IMPORTANT: data is never deleted (sends stay permanent per Klimb's promise);
  free users simply can't *view* older-than-window entries until they upgrade.
  Frame as "your full history is always saved — go Pro to see and analyze it all."
  This is the flagship gate: the upgrade incentive grows with tenure/engagement.
- **Advanced stats** — grade pyramids, personal bests, 8-week trend charts,
  breakdowns by wall angle / climb type (`advanced_stats`)
- **Recap archive** — unlimited recap history (`unlimited_recap_history`) +
  **monthly recaps** (free users see only the latest week)
- **Premium share cards** — custom recap layouts for Instagram/stories
  (`premium_share_cards`)
- **Project insights** — attempt trends, send projections, deeper beta
  (`project_insights`)
- **Nice-to-add Pro sweeteners:** logbook CSV export, profile flair (badges/themes)

These map to the existing registry in `src/lib/entitlementFeatures.ts`
(`freeFeatures` / `proFeatures`). Changes to apply: add a **logbook history window**
(new `usageLimits` value, e.g. `freeLogbookDays: 30`), gate history beyond it,
explicitly move **monthly recaps** into Pro, and add export/flair when ready.

### Still open to workshop
- The free logbook window length (30 vs 60 vs 90 days, or last-N-sends).
- Whether to also cap active projects/favorites for free.
- Whether any stats stay free at all, or all stats become Pro.
- Whether friends/social feed stays free (recommended: keep free for growth).

## What's already built (dormant)
- `src/lib/entitlementFeatures.ts` — free/pro registry, usage limits, upgrade
  prompts, `STOREKIT_CONFIG` (currently only `monthlyProductId =
  com.nickyocom.klimb.pro.monthly`).
- `src/lib/entitlements.tsx` — `EntitlementProvider` / `useEntitlements`:
  `hasProAccess`, `hasLifetimeAccess`, `isTrialActive`, `canUseFeature()`,
  `purchaseMonthly()`, `restorePurchases()`, `manageSubscription()`,
  transaction listeners, per-account entitlement cache, analytics `trackEvent`.
- `src/lib/entitlementLogic.ts` (+ `.test.ts`) — pure access resolution.
- `src/lib/storeKit.ts` — `KlimbStoreKit` native plugin bridge (loadProducts,
  purchase, currentEntitlements, restorePurchases, finishTransaction,
  manageSubscriptions).
- `src/pages/Upgrade.tsx` — the paywall/pricing screen.
- Backend: `user_entitlements` table + `verify-app-store-transaction` edge
  function + `record_entitlement_event` RPC.
- Native `KlimbStoreKit` plugin (Swift, in the iOS project).
- **Dormant switch:** `tsconfig.app.json` excludes `Upgrade.tsx`,
  `entitlements.tsx`, `entitlementLogic.test.ts` so none of it compiles/ships yet.

## Implementation steps for Codex (when Nick says activate)
1. **Products:** add annual + lifetime IDs to `STOREKIT_CONFIG`, e.g.
   `annualProductId = com.nickyocom.klimb.pro.annual`,
   `lifetimeProductId = com.nickyocom.klimb.pro.lifetime`. Update
   `entitlements.tsx` to load all product IDs and add `purchaseAnnual()` /
   `purchaseLifetime()` mirroring `purchaseMonthly()`.
2. **Paywall UI:** update `Upgrade.tsx` to show Monthly / Annual (with localized savings
   framing) / limited-time Lifetime, plus Restore Purchases and links to
   privacy + EULA (already in `STOREKIT_CONFIG`).
3. **Founding cutoff:** implement `FOUNDING_CUTOFF` config + server-side lifetime
   grant for `created_at < cutoff` (see "Founding Members"). Add a Supabase
   migration; keep lifetime non-downgradeable.
4. **Gate features:** wrap Pro features with `useEntitlements().canUseFeature(...)`
   and show the upgrade prompt on locked features. Explicitly gate monthly recaps.
   Do NOT gate logging or community grades.
5. **Activate build:** remove the three entries from `tsconfig.app.json`
   `exclude`, mount `EntitlementProvider`, and route to `Upgrade.tsx`.
6. **Verify:** `tsc -b` clean; test purchase, restore, trial, and founding-member
   free access in StoreKit sandbox before shipping.

## App Store Connect setup (do BEFORE activating; can be prepped early)
- Sign the **Paid Applications Agreement**; complete **banking + tax** forms
  (IAP won't work until this is done).
- Create the **auto-renewable subscription group** with Monthly ($3.99) and
  Annual ($34.99) products, and a **non-consumable** for Lifetime (~$49.99).
- Add the **7-day free-trial** introductory offer to the subscription.
- Fill product metadata + localized display names/descriptions + review screenshot.
- Ship the update that turns the paywall on (IAP requires an app-review pass).

## Activation checklist (flip the switch)
- [ ] App Store Connect products live + banking/tax done
- [ ] `FOUNDING_CUTOFF` date chosen and configured
- [ ] annual + lifetime wired in `STOREKIT_CONFIG` / `entitlements.tsx`
- [ ] `Upgrade.tsx` shows all tiers + Restore + legal links
- [ ] Pro features gated via `canUseFeature`; core loop stays free
- [ ] `tsconfig.app.json` excludes removed; provider mounted
- [ ] `tsc -b` clean; sandbox-tested purchase/restore/trial/founding
- [ ] Submit build for review
