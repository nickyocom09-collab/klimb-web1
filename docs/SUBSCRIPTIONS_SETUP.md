# Klimb Pro launch setup

The app and database code are ready for Free, Pro Monthly, and permanent
Lifetime Pro access. Apple purchases are not production-ready until every item
below is configured and tested.

## Configuration used by the code

| Setting | Temporary/default value | Where it must match |
| --- | --- | --- |
| Monthly product ID | `com.nickyocom.klimb.pro.monthly` | App Store Connect, `.env`, and Supabase secrets |
| Annual product ID | `com.nickyocom.klimb.pro.annual` | App Store Connect, `.env`, and Supabase secrets |
| Bundle ID | `com.nickyocom.klimb` | Apple app record and Supabase secrets |
| Apple app ID | `6792880012` | Supabase secrets |
| Launch-day Lifetime Pro window | `2026-08-17 00:00–23:59:59 America/Chicago` | `0032_launch_day_access_and_navigation.sql` |
| Server notification URL | `https://qanfxjjiegqdmhmgwtxl.supabase.co/functions/v1/app-store-notifications` | App Store Connect production and sandbox notification URLs |

The displayed price, billing period, and yearly savings come from StoreKit
product data. The U.S. reference prices are $3.99/month and $34.99/year; Apple
supplies the localized storefront prices. The
one-day founder window is closed and fixed in server time so its public terms
cannot drift after the offer.

## 1. Apply the database migration

Run the entitlement migrations through
`migrations/0032_launch_day_access_and_navigation.sql` in order. Together they:

- creates the entitlement, transaction, analytics, admin, and audit tables;
- backfills existing users without deleting any data;
- permanently grant every verified account created during August 17, 2026 in
  America/Chicago Lifetime Pro;
- installs server-only founder/admin functions and row-level security; and
- repairs `log_climb` so boulder, top-rope, and lead logs are saved atomically.

Bootstrap the first entitlement administrator from the Supabase SQL Editor
using the authenticated user's real UUID:

```sql
insert into public.entitlement_admins (user_id)
values ('YOUR-ADMIN-USER-UUID')
on conflict (user_id) do nothing;
```

Do not expose the service-role key or allow normal clients to insert into
`entitlement_admins`.

## 2. Create the App Store Connect subscription

1. Open Klimb in App Store Connect.
2. Under **Monetization → Subscriptions**, create a subscription group named
   `Klimb Pro`.
3. Create a monthly auto-renewable subscription with product ID
   `com.nickyocom.klimb.pro.monthly`.
4. Create a yearly auto-renewable subscription with product ID
   `com.nickyocom.klimb.pro.annual`.
5. Choose the price tiers in App Store Connect. The app will use Apple's
   localized `displayPrice`; there is no hard-coded `$2.99` label.
6. Add a **7-day Free Trial** introductory offer for new eligible monthly
   subscribers.
7. Add localization, the subscription review screenshots, and review notes.
8. Complete Paid Apps agreements, tax forms, and banking information.
9. Add Klimb's Terms of Use and Privacy Policy URLs to the app metadata and
   confirm the in-app links point to the final published pages.

As of August 21, 2026, both products have localized pricing and availability in
175 App Store countries/regions, and the monthly product has a one-week free
trial. Paid Apps, banking, and U.S. tax setup are active. Both products still
show **Prepare for Submission** and must be attached to the next app version,
given their review screenshots, and submitted for review before production
purchases can be considered launch-ready.

The Account Holder must also personally accept Apple's updated Developer
Program License Agreement and complete the EU Digital Services Act trader
status flow. Those are legal attestations and must not be completed by an
automated build or development agent.

## 3. Configure Apple server notifications and credentials

Set App Store Server Notifications to **Version 2**. Use this URL for both the
production and sandbox notification fields:

```text
https://qanfxjjiegqdmhmgwtxl.supabase.co/functions/v1/app-store-notifications
```

Both notification fields were configured with this URL on August 21, 2026.

Create an App Store Connect In-App Purchase key for the secure administrator
recheck endpoint. Download it once and store it only as a Supabase secret.

Klimb bundles Apple&apos;s three public root certificates from Apple PKI with the
transaction verifier. They are public trust anchors, not credentials, so
purchase activation does not depend on a manually copied certificate secret.
Private App Store Connect keys must still never enter Git.

```bash
supabase secrets set \
  APPLE_BUNDLE_ID=com.nickyocom.klimb \
  APPLE_APP_ID=6792880012 \
  APPLE_MONTHLY_PRODUCT_ID=com.nickyocom.klimb.pro.monthly \
  APPLE_ANNUAL_PRODUCT_ID=com.nickyocom.klimb.pro.annual \
  APPLE_IAP_KEY_ID=YOUR_IN_APP_PURCHASE_KEY_ID \
  APPLE_IAP_ISSUER_ID=YOUR_ISSUER_ID \
  APPLE_IAP_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions.

## 4. Deploy the secure functions

```bash
supabase functions deploy verify-app-store-transaction
supabase functions deploy app-store-notifications --no-verify-jwt
supabase functions deploy admin-recheck-entitlement
```

`app-store-notifications` cannot require a Klimb session because Apple calls
it directly. It verifies Apple's signed V2 payload before changing access.
The purchase verification and admin recheck functions require a signed-in
Klimb user; the latter also checks `entitlement_admins`.

## 5. Founder controls

Founder access uses `auth.users.created_at` and database server time, not the
device clock. Migration `0032` retired both the older date cutoff and first-100
campaign. Existing lifetime grants remain permanent.

The legacy secure control remains available for support and audit use, but it
must not be re-enabled for the closed launch-day offer:

```sql
select public.admin_set_founder_config(
  false,
  '2026-08-31 23:59:59+00'::timestamptz
);
```

Run that while signed in as a user listed in `entitlement_admins`, or use a
trusted service/admin database session. Existing rows with
`is_lifetime_pro = true` are never downgraded by this setting or by Apple
subscription updates.

Other secure controls:

```sql
select public.admin_get_user_entitlement('TARGET-USER-UUID');
select public.admin_grant_lifetime_pro('TARGET-USER-UUID', 'Support grant');
select public.admin_revoke_manual_lifetime_pro(
  'TARGET-USER-UUID',
  'Incorrect manual grant'
);
```

For a fresh Apple status check, invoke `admin-recheck-entitlement` with:

```json
{ "userId": "TARGET-USER-UUID" }
```

Every administrative grant, revocation, config change, and server recheck is
written to `entitlement_audit_log`.

## 6. Test before release

1. Add a StoreKit configuration in Xcode using the exact monthly product ID.
2. Test purchase success, cancellation, Ask to Buy/pending, expiration,
   renewal, restore on another device, and an unverified transaction.
3. Use App Store Connect sandbox testers to confirm the seven-day introductory
   offer eligibility and Apple-localized price. The free trial still starts
   through Apple's native confirmation sheet; verify that the sheet says the
   first week is free and shows the later renewal price.
4. Send a test App Store Server Notification from App Store Connect and confirm
   it is accepted.
5. Confirm a founder account never sees upgrade prompts and remains Lifetime
   Pro after founder access is disabled.
6. Confirm an expired non-founder subscription returns to Free.
7. Submit a TestFlight build and repeat purchase/restore testing on a real
   device before App Review.
