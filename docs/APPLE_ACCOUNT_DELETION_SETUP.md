# Sign in with Apple account deletion

Klimb keeps Sign in with Apple enabled for signup and login. When an Apple user
deletes their Klimb account, the iOS app asks Apple to authenticate that user
again and sends the resulting one-time authorization code to the
`revoke-apple-authorization` Edge Function. The function exchanges the code and
revokes Apple's refresh token before the Supabase account is removed.

## Required Supabase Edge Function secrets

Set these in the Supabase project's Edge Function secrets. Never add the `.p8`
private key to Git, Vite environment variables, or the iOS bundle.

- `APPLE_SIGN_IN_CLIENT_ID=com.nickyocom.klimb`
- `APPLE_SIGN_IN_TEAM_ID=<Apple Developer Team ID>` (optional when the existing
  `APPLE_TEAM_ID` secret is already set)
- `APPLE_SIGN_IN_KEY_ID=<Sign in with Apple key ID>`
- `APPLE_SIGN_IN_PRIVATE_KEY=<complete .p8 private key contents>`
- `ALLOWED_WEB_ORIGINS=<comma-separated production web origins, if any>`

The Apple key must have Sign in with Apple enabled for the Klimb App ID. A push
notification key should not be reused unless Apple explicitly shows that it has
the Sign in with Apple capability.

## Deploy and verify

Deploy these functions together so they use the shared restricted CORS helper:

```sh
supabase functions deploy revoke-apple-authorization --project-ref qanfxjjiegqdmhmgwtxl
supabase functions deploy verify-app-store-transaction --project-ref qanfxjjiegqdmhmgwtxl
supabase functions deploy admin-recheck-entitlement --project-ref qanfxjjiegqdmhmgwtxl
```

Verification must be performed on a physical iPhone with an Apple-authenticated
test account:

1. Sign in with Apple and confirm normal login succeeds.
2. Open Settings, choose Delete account, and cancel the Apple sheet. Confirm the
   Klimb account and its uploads still exist.
3. Repeat deletion and approve the Apple sheet. Confirm the account, uploads,
   and Apple authorization are removed.
4. Confirm email/password and Google users can still delete without an Apple
   sheet.

Do not deploy the function without the four Apple secrets. It intentionally
fails closed rather than deleting an Apple-linked account without revocation.
