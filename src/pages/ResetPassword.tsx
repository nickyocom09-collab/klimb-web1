import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button, ErrorText, PasswordInput } from "../components/ui";
import { passwordValidationError } from "../lib/authSecurity";

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const passwordError = passwordValidationError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col justify-center bg-bg px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-chalk">
          Choose a new password
        </h1>
        <p className="mt-2 text-muted">Enter and confirm your new password.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <PasswordInput
          label="New password"
          name="new-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <PasswordInput
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy}>
          Update password
        </Button>
      </form>
    </div>
  );
}
