import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, MapPin, Plus, Search } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, CenterSpinner, Spinner } from "../components/ui";
import type { GymRow } from "../lib/database.types";

export function GymSelect() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("gyms")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (active) {
          setGyms(data ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function choose(gym: GymRow) {
    if (!profile) return;
    setSaving(gym.id);
    await supabase
      .from("profiles")
      .update({ home_gym_id: gym.id })
      .eq("id", profile.id);
    await refreshProfile();
    setSaving(null);
    navigate("/", { replace: true });
  }

  const q = query.trim().toLowerCase();
  const filtered = gyms.filter((g) =>
    [g.name, g.city, g.state, g.brand]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(q)),
  );

  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      <header className="border-b border-border px-5 py-4">
        <h1 className="text-2xl font-extrabold text-chalk">Choose your gym</h1>
        <p className="mt-1 text-sm text-muted">
          Pick your home gym to see its routes.
        </p>
      </header>

      <div className="px-5 py-4">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by gym, city, or brand"
            className="h-12 w-full rounded-2xl border border-border bg-surface-2 pl-11 pr-4 text-chalk placeholder:text-faint outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {loading ? (
          <CenterSpinner />
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-center text-faint">
            No gyms yet. Add the first one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((gym) => {
              const selected = gym.id === profile?.home_gym_id;
              return (
                <li key={gym.id}>
                  <button
                    onClick={() => choose(gym)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-accent bg-surface-2"
                        : "border-border bg-surface hover:border-faint"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-chalk">{gym.name}</p>
                      {gym.city || gym.state ? (
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                          <MapPin size={13} />
                          {[gym.city, gym.state].filter(Boolean).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    {saving === gym.id ? (
                      <Spinner className="text-accent" />
                    ) : selected ? (
                      <Check size={20} className="text-accent" />
                    ) : (
                      <ChevronRight size={18} className="text-faint" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-5">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => navigate("/gym/add")}
        >
          <Plus size={18} className="mr-2" /> Add a new gym
        </Button>
      </div>
    </div>
  );
}
