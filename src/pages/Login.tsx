import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button, ErrorText, Input } from "../components/ui";

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
    <div className="relative mx-auto flex h-full max-w-app flex-col justify-center overflow-hidden border-x border-border bg-bg px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
      />
      <div className="relative mb-8 animate-fade-up">
        <h1 className="text-6xl font-extrabold tracking-tight text-accent drop-shadow-[0_2px_24px_rgb(var(--c-accent)/0.4)]">
          Klimb
        </h1>
        <p className="mt-2 text-muted">Community grades for your gym.</p>
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

      <p className="mt-6 text-center text-muted">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-accent">
          Create an account
        </Link>
      </p>
    </div>
  );
}
