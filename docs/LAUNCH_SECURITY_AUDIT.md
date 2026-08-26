# Launch security audit

Last reviewed: August 22, 2026

This checklist records the controls behind the 20-point launch review. It is a
snapshot, not a substitute for monitoring or a professional penetration test.

| # | Control | Status | Implementation / evidence |
|---|---|---|---|
| 1 | Hide API keys | Pass | The client contains only Supabase's publishable URL/key. Apple and service-role secrets stay in Supabase Edge Function secrets. |
| 2 | Purge Git secrets | Pass | Gitleaks 8.30.1 scanned all 149 commits from a healthy mirror clone. Its three findings were the intentionally public Supabase publishable/anon client key; no privileged secret was found. `.env` remains ignored. |
| 3 | Use a public database key | Pass | Browser/native clients use the publishable Supabase key; privileged keys are server-only. |
| 4 | Enable row-level security | Pass | Application tables use RLS policies and authenticated ownership checks. |
| 5 | Encrypt sensitive data | Pass | Supabase/Vercel use TLS in transit; native auth tokens use iOS Keychain storage. Provider-managed encryption covers stored database data. |
| 6 | Enforce server-side auth | Pass | Edge Functions resolve the caller from a verified JWT and sensitive RPCs enforce `auth.uid()`. |
| 7 | Lock record access | Pass | RLS and owner/friend policies scope reads and writes. |
| 8 | Block field tampering | Pass | Security-definer RPCs and database triggers derive ownership and protected fields server-side. |
| 9 | Secure session cookies | N/A | Klimb uses Supabase bearer sessions, not custom session cookies. Native tokens use Keychain-backed storage. |
| 10 | Hash passwords | Pass | Password authentication is managed and hashed by Supabase Auth; Klimb does not store plaintext passwords. |
| 11 | Rate-limit login | Pass | Supabase Auth applies per-IP sign-in/sign-up limits; application write/upload RPCs also rate-limit abuse-prone actions. |
| 12 | Add bot protection | Blocked | Supabase CAPTCHA is currently disabled. Enable Cloudflare Turnstile or hCaptcha only after its public/secret keys and client token flow are configured and tested. |
| 13 | Parameterize queries | Pass | Client/server database access uses Supabase query builders and typed RPC parameters rather than concatenated SQL. |
| 14 | Validate all input | Pass | Client validation is backed by database constraints/triggers and Edge Function validation. |
| 15 | Escape user content | Pass | User content is rendered through React text nodes; no raw HTML rendering path was found. |
| 16 | Restrict file uploads | Pass | Upload functions check authenticated ownership, byte limits, MIME type and file signatures. Direct storage writes are denied. |
| 17 | Trim API responses | Pass | Feed/social RPCs are bounded and sensitive functions return only the fields/results required by callers. Remaining broad selects are limited to owner-scoped internal records. |
| 18 | Add security headers | Pass | App and legal/support hosts set CSP, frame denial, MIME sniffing prevention, referrer/permissions policy, and HSTS. |
| 19 | Force HTTPS | Pass | Production endpoints are HTTPS and HSTS is configured for production hosts. |
| 20 | Scan dependencies | Pass | `npm audit --omit=dev` reported zero known vulnerabilities on August 21, 2026. |

## Required follow-up

1. Configure and test CAPTCHA before enabling it in Supabase Auth. Enabling the
   dashboard switch first would reject sign-in/sign-up requests that do not
   include a valid CAPTCHA token.
2. Repeat the dependency and Git-history scans and review Supabase/Auth logs
   before every release.
