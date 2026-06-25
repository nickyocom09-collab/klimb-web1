import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Home, MapPin, Plus, Search } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AppHeader } from "../components/Layout";
import { Button, CenterSpinner, Spinner } from "../components/ui";
import type { GymRow } from "../lib/database.types";

export function Gyms() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from("gyms").select("*").eq("status", "approved").order("name"),
      supabase
        .from("routes")
        .select("gym_id")
        .eq("status", "active")
        .eq("hidden", false),
    ]).then(([{ data: g }, { data: r }]) => {
      if (!active) return;
      const map = new Map<string, number>();
      for (const row of r ?? []) {
        map.set(row.gym_id, (map.get(row.gym_id) ?? 0) + 1);
      }
      setGyms(g ?? []);
      setCounts(map);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function setHome(gym: GymRow) {
    if (!profile || gym.id === profile.home_gym_id) {
      navigate("/");
      return;
    }
    setSaving(gym.id);
    await supabase
      .from("profiles")
      .update({ home_gym_id: gym.id })
      .eq("id", profile.id);
    await refreshProfile();
    setSaving(null);
    navigate("/");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gyms;
    return gyms.filter((g) =>
      [g.name, g.city, g.state, g.brand]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [gyms, query]);

  const stateNames: Record<string, string> = {
    AR: "Arkansas",
    OK: "Oklahoma",
    MO: "Missouri",
    KS: "Kansas",
    TN: "Tennessee",
  };
  const groups = useMemo(() => {
    const map = filtered.reduce<Record<string, GymRow[]>>((acc, g) => {
      const key = g.state?.trim() || "Other";
      (acc[key] ??= []).push(g);
      return acc;
    }, {});
    const states = Object.keys(map).sort((a, b) =>
      (stateNames[a] ?? a).localeCompare(stateNames[b] ?? b),
    );
    return { map, states };
  }, [filtered]);

  return (
    <div>
      <AppHeader title="Gyms" subtitle="Browse & switch" />

      <div className="px-5 py-3">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search gym, city, or brand"
            className="h-12 w-full rounded-2xl border border-border bg-surface-2 pl-11 pr-4 text-chalk placeholder:text-faint outline-none focus:border-accent"
          />
        </div>
      </div>

      {loading ? (
        <CenterSpinner />
      ) : filtered.length === 0 ? (
        <p className="mt-8 px-5 text-center text-faint">No gyms found.</p>
      ) : (
        <div className="flex flex-col gap-6 px-5">
          {groups.states.map((state) => (
            <section key={state}>
              <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-faint">
                {stateNames[state] ?? state}
              </h2>
              <ul className="flex flex-col gap-2">
                {groups.map[state].map((gym) => {
                  const home = gym.id === profile?.home_gym_id;
                  const count = counts.get(gym.id) ?? 0;
                  return (
                    <li key={gym.id}>
                      <button
                        onClick={() => setHome(gym)}
                        className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                          home
                            ? "border-accent bg-surface-2"
                            : "border-border bg-surface hover:border-faint"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-semibold text-chalk">
                            <span className="truncate">{gym.name}</span>
                            {home ? (
                              <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                                <Home size={10} /> Home
                              </span>
                            ) : null}
                          </p>
                          {gym.city || gym.state ? (
                            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                              <MapPin size={13} />
                              {[gym.city, gym.state].filter(Boolean).join(", ")}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-xs text-faint">
                            {count} active {count === 1 ? "route" : "routes"}
                          </p>
                        </div>
                        {saving === gym.id ? (
                          <Spinner className="text-accent" />
                        ) : home ? (
                          <Check size={20} className="shrink-0 text-accent" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="p-5">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => navigate("/gym/add")}
        >
          <Plus size={18} className="mr-2" /> Suggest a new gym
        </Button>
      </div>
    </div>
  );
}
