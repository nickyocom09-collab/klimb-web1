import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button, ErrorText, Input } from "../components/ui";
import { OAuthButtons } from "../components/OAuthButtons";

export function Signup() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (displayName.trim().length < 2) {
      setError("Pick a display name (at least 2 characters).");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
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
      setNotice(
        "Account created. Check your inbox to confirm your email, then log in.",
      );
    }
    // Otherwise auth state flips and the router redirects to gym selection.
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col justify-center bg-bg px-6">
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
            climb 🧗
          </li>
        </ol>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="The name other climbers see"
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
        />
        <ErrorText>{error}</ErrorText>
        {notice ? (
          <p className="ml-1 text-sm text-accent">{notice}</p>
        ) : null}
        <Button type="submit" loading={busy}>
          Create my account
        </Button>
        <p className="text-center text-xs text-faint">
          By continuing you agree to climb responsibly and log honestly.
        </p>
      </form>

      <div className="relative mt-5">
        <OAuthButtons />
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
