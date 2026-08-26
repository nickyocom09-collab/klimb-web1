import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button, ErrorText, Input, PasswordInput } from "../components/ui";
import { OAuthButtons } from "../components/OAuthButtons";
import { profileNameError } from "../lib/nameModeration";
import {
  MIN_PASSWORD_LENGTH,
  passwordValidationError,
} from "../lib/authSecurity";
import { EmailVerificationPending } from "../components/EmailVerificationPending";
import { rememberLegalAcceptance } from "../lib/legalAcceptance";

export function Signup() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acceptedLegal) {
      setError("Confirm your age and accept the Terms and Privacy Policy to continue.");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("Pick a display name (at least 2 characters).");
      return;
    }
    const moderationError = profileNameError(displayName);
    if (moderationError) {
      setError(moderationError);
      return;
    }
    const passwordError = passwordValidationError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }
    rememberLegalAcceptance();
    setBusy(true);
    const { error, needsConfirmation } = await signUp(
      email,
      password,
      displayName,
    );
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (needsConfirmation) {
      setPendingEmail(email.trim());
    }
    // Otherwise auth state flips and the router redirects to gym selection.
  }

  if (pendingEmail) {
    return (
      <EmailVerificationPending
        email={pendingEmail}
        onChangeEmail={() => setPendingEmail(null)}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-app flex-col justify-start overflow-y-auto bg-bg px-6 py-8 sm:justify-center">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-chalk">Create your account</h1>
        <p className="mt-2 text-muted">
          Free to join. It takes about a minute:
        </p>
        <ol className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
          <li className="flex gap-2">
            <span className="font-bold text-accent">1.</span> Fill in your name,
            email &amp; a password below
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-accent">2.</span> Pick your home gym
            on the map
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-accent">3.</span> Log your first
            Klimb 🧗
          </li>
        </ol>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Display name"
          name="display-name"
          autoComplete="name"
          maxLength={60}
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="The name other climbers see"
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <PasswordInput
          label="Password"
          name="new-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
        <PasswordInput
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Type it again"
        />
        <ErrorText>{error}</ErrorText>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-3 text-xs leading-relaxed text-muted">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(event) => setAcceptedLegal(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--c-accent))]"
          />
          <span>
            I confirm I am at least 13 and agree to the{" "}
            <Link to="/terms" className="font-semibold text-chalk underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="font-semibold text-chalk underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <Button type="submit" loading={busy} disabled={!acceptedLegal}>
          Create my account
        </Button>
      </form>

      <div className="relative mt-5">
        <OAuthButtons
          disabled={!acceptedLegal}
          onBeforeSignIn={() => {
            if (!acceptedLegal) {
              setError(
                "Confirm your age and accept the Terms and Privacy Policy to continue.",
              );
              return false;
            }
            rememberLegalAcceptance();
            return true;
          }}
        />
      </div>

      <p className="mt-6 text-center text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-accent">
          Log in
        </Link>
      </p>
    </div>
  );
}
