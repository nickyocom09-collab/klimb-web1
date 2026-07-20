import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { authRedirectUrl } from "../lib/deeplink";
import { Button, ErrorText, Input } from "../components/ui";

/**
 * Password reset via a 6-digit code — no email link to tap, so no Safari
 * hand-off and no broken redirect. Phase 1: enter email, we send the code.
 * Phase 2: enter the code + a new password, verify, and you're back in.
 * (The email also still carries a magic link for the web, via redirectTo.)
 */
export function ForgotPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl("reset-password"),
    });
    setBusy(false);
    // Don't leak whether the email exists — advance regardless (only a real
    // send-side failure like a rate limit is worth surfacing).
    if (error && /rate|too many/i.test(error.message)) {
      setError("Too many attempts — wait a minute and try again.");
      return;
    }
    setPhase("code");
  }

  async function verifyAndReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const { error: vErr } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "recovery",
    });
    if (vErr) {
      setBusy(false);
      setError("That code is invalid or expired. Check it or resend a new one.");
      return;
    }
    const { error: uErr } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col justify-center bg-bg px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-chalk">
          {phase === "email" ? "Reset password" : "Enter your code"}
        </h1>
        <p className="mt-2 text-muted">
          {phase === "email"
            ? "Enter your email and we'll send you a 6-digit code."
            : `We sent a code to ${email}. Enter it below with your new password.`}
        </p>
      </div>

      {phase === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
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
            Send code
          </Button>
          <Link
            to="/login"
            className="text-center text-sm text-muted hover:text-chalk"
          >
            Back to log in
          </Link>
        </form>
      ) : (
        <form onSubmit={verifyAndReset} className="flex flex-col gap-4">
          <Input
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          <ErrorText>{error}</ErrorText>
          <Button
            type="submit"
            loading={busy}
            disabled={code.length < 6 || password.length < 6}
          >
            Set new password
          </Button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCode("");
              setPhase("email");
            }}
            className="text-center text-sm text-muted hover:text-chalk"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
