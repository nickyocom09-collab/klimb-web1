import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Spinner } from "./ui";

/** Google "G" mark (official four-color). */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/** Apple logo — inherits currentColor so it works in dark and light. */
function AppleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 12.7c-.03-2.6 2.12-3.85 2.22-3.9-1.21-1.77-3.1-2.02-3.77-2.05-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.4.86 1.26 1.89 2.67 3.24 2.62 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.73-1.05-2.76-4.16-.03-2.61 2.12-3.86 2.22-3.92zM14.53 4.6c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.45z" />
    </svg>
  );
}

/**
 * "Continue with Google / Apple" — sits under the email form on the login and
 * signup screens. Kicks off a Supabase OAuth redirect; on return the app
 * routes new users through onboarding.
 */
export function OAuthButtons() {
  const { signInWithProvider } = useAuth();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(provider: "google" | "apple") {
    setError(null);
    setBusy(provider);
    const { error } = await signInWithProvider(provider);
    // On success the browser redirects away, so we only land here on failure.
    if (error) {
      setError(error);
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-faint">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={() => go("google")}
        disabled={busy !== null}
        className="flex h-12 items-center justify-center gap-3 rounded-2xl border border-border bg-surface-2 font-semibold text-chalk transition hover:border-faint active:scale-[0.99] disabled:opacity-60"
      >
        {busy === "google" ? <Spinner className="text-chalk" /> : <GoogleMark />}
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => go("apple")}
        disabled={busy !== null}
        className="flex h-12 items-center justify-center gap-2.5 rounded-2xl border border-border bg-surface-2 font-semibold text-chalk transition hover:border-faint active:scale-[0.99] disabled:opacity-60"
      >
        {busy === "apple" ? <Spinner className="text-chalk" /> : <AppleMark />}
        Continue with Apple
      </button>

      {error ? (
        <p className="text-center text-sm text-wide">{error}</p>
      ) : null}
    </div>
  );
}
