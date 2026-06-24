import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, ErrorText, Input } from "../components/ui";

export function GymAdd() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Enter a gym name.");
      return;
    }
    if (!profile) return;
    setBusy(true);
    // Suggested gyms come in as pending; an admin approves them before they
    // appear in the selector.
    const { error } = await supabase.from("gyms").insert({
      name: name.trim(),
      city: city.trim() || null,
      state: state.trim() || null,
      status: "pending",
      created_by: profile.id,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.alert(
      "Thanks! Your gym was submitted and will appear once it's approved.",
    );
    navigate("/gym/select", { replace: true });
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      <header className="flex items-center gap-2 border-b border-border px-3 py-4">
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-1 text-muted hover:text-chalk"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-extrabold text-chalk">Add a gym</h1>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
        <Input
          label="Gym name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Movement Englewood"
        />
        <Input
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Denver"
        />
        <Input
          label="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="CO"
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy}>
          Add gym
        </Button>
      </form>
    </div>
  );
}
