import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { authRedirectUrl } from "../lib/deeplink";
import { Button, ErrorText, Input } from "../components/ui";

/**
 * Password reset via the email link. Runs on Supabase's built-in email with
 * the default template — no SMTP needed. Tapping the link opens the app
 * (deep link) straight to the set-new-password screen.
 */
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl("reset-password"),
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col justify-center bg-bg px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-chalk">
          Reset password
        </h1>
        <p className="mt-2 text-muted">
          Enter your email and we'll send a reset link.
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            If an account exists for{" "}
            <span className="text-chalk">{email}</span>, a reset link is on its
            way. Open it on this device and it'll bring you right back to
            Klimb to set a new password.
          </p>
          <Link to="/login" className="text-center font-semibold text-accent">
            Back to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={busy} disabled={email.trim() === ""}>
            Send reset link
          </Button>
          <Link
            to="/login"
            className="text-center text-sm text-muted hover:text-chalk"
          >
            Back to log in
          </Link>
        </form>
      )}
    </div>
  );
}
