# Klimb legal, platform, licensing, and security risk audit

**Audit date:** August 17, 2026  
**Scope:** the current local source tree and selected production Supabase controls  
**Important:** this is an engineering risk review, not legal advice and not a
promise that a claim, investigation, breach, or App Store action cannot occur.
A qualified lawyer should review the product, launch regions, business entity,
Terms, Privacy Policy, and insurance.

## Executive result

The current local source has meaningful protections: in-app report and block
controls, client and database defenses, account deletion, plain-language Terms
and Privacy pages, no advertising trackers, local-only distance checks, upload
type/size limits, RLS on every public table, and restricted privileged database
functions. The production database also has migration `0028`'s four permanent
block-enforcement triggers.

The risk is **not zero**. The largest remaining risks are operational or require
an external decision: timely human moderation, production email delivery,
Sign in with Apple token revocation secrets and deployment, physical-device
testing, an accurate App Store privacy label, copyright-agent registration,
trademark clearance, accessibility testing, launch-region privacy analysis,
an appropriate business entity/insurance, and lawyer review.

Production migrations `0030` and `0031` were applied and verified during this
audit. `0030` has no acceptance rows yet because the local signup UI that calls
it has not been distributed. `0031` now provides six server-side content-filter
triggers, including the profile-name backstop missing from production.
The revised privacy, terms, support, and email-verification pages were also
published to `https://klimb-privacy.vercel.app` and hash-verified against the
validated local source.

The release currently selected at Apple is build 61. The most recent successful
TestFlight upload found locally is build 64. The fixes described in this audit
are in the newer local source (project build 65) and are **not** in either of
those already-uploaded binaries unless a new archive is uploaded.

## Findings and actions

### 1. User-generated content and community safety — high

Klimb accepts names, notes, photos, route details, reactions, and social
activity. Apple requires objectionable-content filtering, reporting, timely
responses, blocking, and published contact information. The app has filtering,
reporting, blocking, and contact paths, and production migration `0028` prevents
blocked users from recreating direct relationships. A real person still must
review reports and support mail on a written schedule; reports that sit unseen
do not satisfy the “timely response” requirement.

Action: assign an operator, document response targets and escalation, test every
report/block direction on a physical phone, and retain a limited moderation
audit trail. Do not publish private report details.

Source: [Apple App Review Guidelines §1.2](https://developer.apple.com/app-store/review/guidelines/).

### 2. Privacy statements and App Store privacy answers — high

The current policy describes the principal data categories, providers,
visibility controls, location behavior, retention criteria, account deletion,
AI status, and international processing. The App Store answers must match the
exact released binary and all integrated providers. Apple allows privacy-answer
updates without a binary update, but a privacy-policy URL change normally ships
with the next app version.

Action: before release, compare App Store Connect line by line with actual
production behavior. Disclose email, user content/photos, user and device
identifiers (including push tokens), purchase history, and product interaction
when retained. Do not declare tracking while no cross-company tracking occurs.
Re-audit before adding analytics, AI, ads, precise-location transmission, or a
new SDK.

The Google-login package bundles Meta/Facebook frameworks even though Facebook
login is disabled. The iOS plist now explicitly disables Facebook SDK automatic
initialization, automatic event logging, and advertiser-ID collection. The
Facebook App ID remains only for Instagram Stories' `source_application`
handoff. Confirm these settings in the archived binary whenever the login SDK
changes.

Sources: [Apple manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/), and [FTC Start with Security](https://www.ftc.gov/business-guidance/resources/start-security-guide-business).

### 3. Account deletion and Sign in with Apple revocation — high

The local app deletes account data and uploaded media in-app. Apple also expects
associated user-generated content to be deleted unless retention is legally
required, and apps using Sign in with Apple should revoke the user's tokens.
The revocation code exists, but production secrets/deployment and an end-to-end
physical-device test remain unverified.

Action: create and privately store the Apple key, deploy and test
`revoke-apple-authorization`, verify deletion for email/Google/Apple accounts,
and explain that deleting Klimb does not cancel Apple billing.

Sources: [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) and [Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple).

### 4. Children and age — high if under-13 use is known

Klimb is stated to be a general-audience service for people 13 and older. The
new local signup uses an unchecked age/Terms/Privacy confirmation and migration
`0030` stores an append-only, server-timestamped acceptance record. This reduces
risk but cannot prove age. If Klimb becomes directed to children or gains actual
knowledge that a user is under 13, COPPA can require parental notice and
verifiable consent before collecting personal information.

Action: do not market to under-13 children; promptly delete suspected under-13
accounts after appropriate verification; obtain counsel before changing the age
audience or adding child-oriented features.

Source: [FTC COPPA compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business).

### 5. Copyright and user uploads — high until process is operational

Users may upload photos or text they do not own. The Terms require permission,
provide a complaint route, and state a repeat-infringer policy. That alone does
not establish DMCA safe-harbor eligibility.

Action: designate a DMCA agent with the U.S. Copyright Office, publish the same
agent contact information, keep it current, implement notice/counter-notice and
repeat-infringer procedures, and remove qualifying material expeditiously.
Do not publish a personal home address without first choosing an appropriate
business/agent address.

Sources: [Copyright Office DMCA agent directory](https://www.copyright.gov/dmca-directory/) and [DMCA overview](https://www.copyright.gov/dmca/).

### 6. Open-source and map licensing — medium, corrected locally

The map previously hid attribution while loading CARTO tiles containing
OpenStreetMap data. The local source now shows persistent OpenStreetMap and
CARTO attribution. A generated in-app notices page contains license text for
303 installed packages. This is especially important because
`react-leaflet@5.0.0` uses the Hippocratic License 2.1 and
`@capgo/capacitor-social-login` uses MPL-2.0.

Action: regenerate notices whenever dependencies change. Avoid modifying MPL
covered library files without satisfying its source-availability obligations.
Consider replacing `react-leaflet` with a conventional permissive-license
alternative to reduce nonstandard license risk.

Sources: [React Leaflet license](https://github.com/PaulLeCam/react-leaflet/blob/master/LICENSE.md), [CARTO attribution](https://carto.com/attribution/), and [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).

### 7. Security and privacy promises — ongoing

The repository history scan found no committed private-key, certificate, or
`.env` blobs; only an example environment file. `.env` is ignored. The live
database audit found no public tables without RLS, no privileged function
executable by `anon` or `public`, and no privileged function missing a fixed
`search_path`. Avatar and route-photo buckets are intentionally public and have
file-size/type limits. Public media URLs are not confidential; the policy says
not to upload confidential images.

Action: enable MFA everywhere; keep admin access least-privileged; rotate any
secret ever pasted into chat, Git, or a client; monitor logs; back up and test
restore; set rate limits; patch dependencies; keep an incident-response plan;
and consider private/signed route media if future privacy promises require it.

Source: [FTC app-developer security guidance](https://www.ftc.gov/business-guidance/resources/app-developers-start-security).

### 8. Accessibility — medium and operational

Automated type/lint/build tests do not prove accessibility. Public-facing
business services may face accessibility obligations, and Apple now supports
accessibility nutrition labels.

Action: test VoiceOver, Dynamic Type, Reduce Motion, contrast, focus order,
button labels, text alternatives, keyboard operation on web, and the smallest
and largest supported iPhones. Provide a working route for accessibility
feedback and do not claim an accessibility feature in App Store Connect until
the whole app meets Apple's evaluation criteria.

Sources: [DOJ ADA web guidance](https://www.ada.gov/resources/web-guidance/) and [Apple accessibility labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/).

### 9. Trademark, gym names, photos, and marketing claims — medium

An abandoned historic federal `KLIMB` record is not a clearance opinion. App,
company, domain, state, common-law, and international conflicts can still
exist. Gym listings can use names descriptively, but avoid suggesting
affiliation. The local Terms now state that listings do not imply sponsorship.
App Store screenshot photos have source links and a Pexels license record.

Action: have a trademark lawyer perform and document a full clearance search
before investing heavily in the name; retain original design/source files and
licenses; get releases for recognizable people where needed; and substantiate
all performance, privacy, “free,” recap, testimonial, and subscription claims.

Source: [USPTO guidance on similar-mark searches](https://www.uspto.gov/trademarks/basics/why-search-similar-trademarks).

### 10. Subscriptions and promotions — high when monetization launches

Subscriptions must use Apple in-app purchase, display the exact price, period,
trial, auto-renewal, and cancellation terms before purchase, restore purchases,
and provide ongoing value. The August 17 Lifetime Pro offer is now based on a
fixed America/Chicago server-time window, and marketing copy must match that
implemented eligibility exactly (verified account creation, not an App Store
download event that Klimb cannot observe).

Action: submit the first subscription with an app version, test sandbox purchase
and restore, keep founder grants server-side, disclose offer terms clearly, and
never convert a promised lifetime grant into a paid subscription without the
user's affirmative purchase.

Production migration `0032` was applied on August 17, 2026. It preserved all
earlier lifetime grants and backfilled qualifying launch-day accounts.

Sources: [Apple App Review Guidelines §3.1](https://developer.apple.com/app-store/review/guidelines/) and [Apple subscription setup](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/).

### 11. Business structure, contracts, and insurance — owner action

The public policies currently identify Nick Yocom personally as the operator.
Code cannot decide whether an LLC/corporation, separate bank/accounting, vendor
agreements, general liability, media liability, cyber coverage, or another
structure is appropriate. A liability disclaimer is not a universal shield.

Action: before meaningful scale or revenue, ask a qualified local lawyer and
insurance professional about entity formation, contracts, governing law,
dispute terms, liability limitations, climbing-specific exposure, and coverage.

## Release gate

Do not describe the current uploaded build as containing this audit's fixes.
To ship them, archive a new iOS build, test that exact archive on a physical
iPhone, and upload it. Uploading a newer
TestFlight build does not replace build 61 in its existing
App Store submission unless that submission is canceled and a different build
is selected.
