# Klimb Pro launch setup

The app and database code are ready for Free, Pro Monthly, and permanent
Lifetime Pro access. Apple purchases are not production-ready until every item
below is configured and tested.

## Configuration used by the code

| Setting | Temporary/default value | Where it must match |
| --- | --- | --- |
| Monthly product ID | `com.nickyocom.klimb.pro.monthly` | App Store Connect, `.env`, Supabase secrets, `entitlement_config` |
| Bundle ID | `com.nickyocom.klimb` | Apple app record and Supabase secrets |
| Apple app ID | `6792880012` | Supabase secrets |
| Founder cutoff | `2026-08-31 23:59:59+00` | `entitlement_config.founders_cutoff_at` |
| Server notification URL | `https://qanfxjjiegqdmhmgwtxl.supabase.co/functions/v1/app-store-notifications` | App Store Connect production and sandbox notification URLs |

The product ID and cutoff are intentionally configurable. The displayed price
and billing period come from StoreKit product data.

## 1. Apply the database migration

Run `migrations/0015_entitlements_and_logging_repair.sql` in the Supabase SQL
Editor or through your normal migration workflow. It:

- creates the entitlement, transaction, analytics, admin, and audit tables;
- backfills existing users without deleting any data;
- permanently grants eligible pre-cutoff users Lifetime Pro;
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
4. Choose the monthly price tier in App Store Connect. The app will use Apple's
   localized `displayPrice`; there is no hard-coded `$2.99` label.
5. Add a **7-day Free Trial** introductory offer for new eligible subscribers.
6. Add localization, the subscription review screenshot, and review notes.
7. Complete Paid Apps agreements, tax forms, and banking information.
8. Add Klimb's Terms of Use and Privacy Policy URLs to the app metadata and
   confirm the in-app links point to the final published pages.

## 3. Configure Apple server notifications and credentials

Set App Store Server Notifications to **Version 2**. Use this URL for both the
production and sandbox notification fields:

```text
https://qanfxjjiegqdmhmgwtxl.supabase.co/functions/v1/app-store-notifications
```

Create an App Store Connect In-App Purchase key for the secure administrator
recheck endpoint. Download it once and store it only as a Supabase secret.

Download Apple's current root certificates from Apple PKI. Convert each
certificate to base64/PEM text and provide them as a JSON array. Never commit
the private key or certificates to Git.

```bash
supabase secrets set \
  APPLE_BUNDLE_ID=com.nickyocom.klimb \
  APPLE_APP_ID=6792880012 \
  APPLE_MONTHLY_PRODUCT_ID=com.nickyocom.klimb.pro.monthly \
  APPLE_IAP_KEY_ID=YOUR_IN_APP_PURCHASE_KEY_ID \
  APPLE_IAP_ISSUER_ID=YOUR_ISSUER_ID \
  APPLE_IAP_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----' \
  APPLE_ROOT_CA_CERTIFICATES_BASE64_JSON='["APPLE_ROOT_CERTIFICATE_TEXT"]'
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
device clock. To end future founder grants without touching existing members,
call the secure admin function:

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
   offer eligibility and Apple-localized price.
4. Send a test App Store Server Notification from App Store Connect and confirm
   it is accepted.
5. Confirm a founder account never sees upgrade prompts and remains Lifetime
   Pro after founder access is disabled.
6. Confirm an expired non-founder subscription returns to Free.
7. Submit a TestFlight build and repeat purchase/restore testing on a real
   device before App Review.
