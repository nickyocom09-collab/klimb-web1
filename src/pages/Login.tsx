import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button, ErrorText, Input } from "../components/ui";
import { OAuthButtons } from "../components/OAuthButtons";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <div className="relative mx-auto flex h-full max-w-app flex-col justify-center overflow-hidden bg-bg px-6">
      <div className="relative mb-8 animate-fade-up">
        <h1 className="text-6xl font-extrabold tracking-tight text-accent">
          Klimb
        </h1>
        <p className="mt-2 text-muted">
          Your sends, your stats, all in one place.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="relative flex animate-fade-up flex-col gap-4 [animation-delay:80ms]"
      >
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy}>
          Log in
        </Button>
        <Link
          to="/forgot-password"
          className="text-center text-sm text-muted hover:text-chalk"
        >
          Forgot your password?
        </Link>
      </form>

      <div className="relative mt-5">
        <OAuthButtons />
      </div>

      <p className="mt-6 text-center text-muted">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-accent">
          Create an account
        </Link>
      </p>
    </div>
  );
}
