# Klimb launch-readiness checklist

This is the operator checklist for the public App Store release. It complements
the automated tests; it is not a guarantee against legal claims or security
incidents. Re-check it whenever the app, SDKs, data practices, or business model
changes.

## Must be complete before public release

- [x] Apply every migration through `0032_launch_day_access_and_navigation.sql`
  to the production Supabase project and verify each query succeeds.
- [x] Apply `0030_legal_acceptance_records.sql`; verify the table, RLS, and RPC
  grants. (Completed August 17, 2026.)
- [ ] With the next signup build, verify a new email, Apple, and Google signup
  each creates a server-timestamped `legal_acceptances` row.
- [x] Apply `0031_server_content_filtering.sql`; verify all six triggers exist,
  clean content passes, and prohibited text is rejected. (Completed August 17,
  2026.)
- [ ] Configure and test a production email sender in Supabase. The built-in
  sender is suitable only for light testing and can rate-limit verification and
  password-reset email.
- [ ] Create the Sign in with Apple key, set the server-side revocation secrets,
  deploy `revoke-apple-authorization`, and delete a Sign in with Apple test
  account end to end. Never place the Apple private key in the app bundle or Git.
- [ ] Test email, Apple, and Google signup; verification; login; password reset;
  logout; email change; and account deletion on a physical iPhone.
- [ ] Test notification permission, every notification type, notification deep
  links, and disabling notifications in both Klimb and iOS Settings.
- [ ] Test logging at 0, 29, 30, and 31 miles, plus the previously-unlocked
  anywhere flow, with good, denied, unavailable, and weak network conditions.
- [ ] Test public/private sends, projects, notes, friends lists, per-climb profile
  posting, reporting, blocking, unblocking, and both directions of a block.
- [ ] Assign a real person to review content reports and support mail regularly.
  Apple requires timely handling of objectionable-content reports.
- [x] Confirm the support, privacy-policy, terms, and email-verification URLs
  work without signing in. (Published and hash-verified August 17, 2026.)
- [ ] Register and publish a DMCA designated agent, then document takedown,
  counter-notice, and repeat-infringer procedures for user uploads.
- [x] Generate and inspect the in-app open-source notices and keep
  OpenStreetMap/CARTO attribution visible. Repeat this check whenever a package
  changes.
- [ ] Make an encrypted backup and confirm the recovery process for Supabase.
- [ ] Turn on MFA for Apple, Supabase, GitHub, Vercel, domain/email, and any
  payment or support accounts. Use unique passwords and store recovery codes
  offline.
- [ ] Remove departed collaborators, unused tokens, old deploy keys, and stale
  OAuth redirect URLs. Rotate any secret that has ever entered Git or a client
  bundle.
- [ ] Have a qualified lawyer review the Terms, Privacy Policy, age approach,
  climbing-risk language, and launch regions. Product copy cannot guarantee
  legal compliance in every jurisdiction.
- [ ] In App Store Connect → Pricing and Availability → App Availability,
  select only the countries or regions the business has approved, then resolve
  every status other than Available (for example, missing ratings or territory
  agreements). Check the same territories on the Pro subscription. Allow up to
  24 hours for an availability change, and test the public App Store link using
  Apple Accounts whose storefronts are set to representative non-US regions.
- [ ] If the shared URL is a TestFlight public link, open its External Testing
  group and confirm the current build is approved and assigned, the link is
  enabled and not full, and its device/OS criteria are not excluding those
  testers. Review the “Didn't Meet Criteria” public-link metric. TestFlight
  eligibility is separate from production App Store country availability.
- [ ] In App Store Connect → App Information → Age Ratings, answer the current
  questionnaire from actual behavior: Klimb contains user-generated content,
  social/friend features, photos, videos, comments, and reactions. Use the
  resulting rating and do not leave the app at 4+ merely because the content is
  climbing-focused. The present product policy is 13+.
- [x] Signup requires an affirmative “at least 13” confirmation and stores a
  server-timestamped acceptance record. Do not collect a full birthday unless a
  future feature or applicable law genuinely requires it; minimizing birth-date
  data lowers privacy and security exposure.
- [ ] Before enabling the public video library, deploy `upload-video`, verify
  Pro authorization, MP4/MOV signature and size rejection, blocking, deletion,
  report/moderation coverage, and the App Store Photos or Videos disclosure.

## App Store privacy answers to verify

Answer from actual production behavior, not this document. At the current code
state, the likely disclosures are:

- Contact Info → Email Address: linked to the user; app functionality.
- User Content → Photos or Videos and Other User Content: linked to the user;
  app functionality. This includes climbs, notes, reactions, social content,
  reports, and support messages retained by Klimb.
- Identifiers → User ID and Device ID: linked to the user; app functionality.
  The device identifier disclosure covers stored push tokens.
- Purchases → Purchase History: linked to the user; app functionality.
- Usage Data → Product Interaction: linked to the user; app functionality, if
  entitlement and purchase-event records remain in production.
- Location: the current distance check stays on-device and does not retain or
  transmit device coordinates, so it is likely outside Apple's definition of
  data “collected” for the privacy label. Confirm the current questionnaire and
  declare Precise Location immediately if a future build transmits or retains it.
- Tracking: No, provided no advertising, fingerprinting, data-broker sharing,
  or cross-company tracking SDK is added.

The App Store privacy answers must include data collected by Apple, Supabase,
Google, and every future SDK or service used by the app. Update the Privacy
Policy and App Store answers before shipping a change in data practice.

## Release-candidate test pass

- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and
  `npm audit --omit=dev` from a clean dependency install.
- [ ] Build the iOS project for a simulator and archive the exact release commit.
- [ ] Test on the smallest and largest supported iPhone, light/dark themes,
  Dynamic Type, VoiceOver, Reduce Motion, weak Wi-Fi, cellular, and offline.
- [ ] Verify weekly recap totals against raw logs for an empty week, a mixed
  boulder/rope week, flashes, projects, and the week boundary/time zone.
- [ ] Verify all destructive actions confirm scope and all errors explain a safe
  recovery step without exposing internal stack traces.
- [ ] Confirm the build selected for App Review is intentional. A newer
  TestFlight build does not replace an already-submitted build unless the
  submission is canceled and changed in App Store Connect.

## Ongoing operation

- Review Supabase security and database logs, App Store crash reports, support
  mail, and content reports on a defined schedule.
- Patch dependencies regularly, but test and release deliberately.
- Keep a written incident-response plan: contain access, preserve evidence,
  rotate credentials, assess notification duties, notify affected people when
  required, and document remediation.
- Re-run this checklist whenever adding analytics, AI, payments, advertising,
  location retention, health data, direct messaging, or support for children.
