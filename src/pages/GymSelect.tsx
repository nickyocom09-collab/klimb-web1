import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, MapPin, Plus, Search } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, CenterSpinner, Spinner } from "../components/ui";
import { US_STATES, STATE_NAME } from "../lib/states";
import type { GymRow } from "../lib/database.types";

export function GymSelect() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  // Which state's gyms are open. null = showing the list of all states.
  const [openState, setOpenState] = useState<string | null>(null);

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

  // Count gyms per state code (for the badges on the state list).
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of gyms) {
      const k = g.state?.trim();
      if (k) m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [gyms]);

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return gyms.filter((g) =>
      [g.name, g.city, g.state, g.brand]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [gyms, q]);

  const stateGyms = useMemo(
    () => (openState ? gyms.filter((g) => g.state?.trim() === openState) : []),
    [gyms, openState],
  );

  function renderGym(gym: GymRow) {
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
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      <header className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          {openState ? (
            <button
              onClick={() => setOpenState(null)}
              aria-label="Back to states"
              className="-ml-2 rounded-full p-1 text-muted transition hover:text-chalk"
            >
              <ChevronLeft size={24} />
            </button>
          ) : profile?.home_gym_id ? (
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="-ml-2 rounded-full p-1 text-muted transition hover:text-chalk"
            >
              <ChevronLeft size={24} />
            </button>
          ) : null}
          <h1 className="text-2xl font-extrabold text-chalk">
            {openState ? STATE_NAME[openState] ?? openState : "Choose your gym"}
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          {openState
            ? "Pick your home gym to see its routes."
            : "Pick your state, then your home gym."}
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
        ) : q ? (
          // Search overrides the drill-down: flat results across all states.
          searchResults.length === 0 ? (
            <p className="mt-8 text-center text-faint">No gyms found.</p>
          ) : (
            <ul className="flex flex-col gap-2 pb-4">
              {searchResults.map(renderGym)}
            </ul>
          )
        ) : openState ? (
          stateGyms.length === 0 ? (
            <p className="mt-8 text-center text-faint">
              No gyms here yet. Add the first one below.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 pb-4">
              {stateGyms.map(renderGym)}
            </ul>
          )
        ) : (
          // The list of every state. Tap to open that state's gyms.
          <ul className="flex flex-col gap-2 pb-4">
            {US_STATES.map((s) => {
              const n = counts[s.code] ?? 0;
              return (
                <li key={s.code}>
                  <button
                    onClick={() => setOpenState(s.code)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-faint"
                  >
                    <span className="font-semibold text-chalk">{s.name}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          n > 0 ? "text-accent" : "text-faint"
                        }`}
                      >
                        {n > 0 ? `${n} ${n === 1 ? "gym" : "gyms"}` : "—"}
                      </span>
                      <ChevronRight size={18} className="text-faint" />
                    </span>
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
