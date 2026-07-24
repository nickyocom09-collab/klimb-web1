import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  MapPin,
  Search,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { assertNearGym } from "../lib/location";
import { AppHeader } from "../components/Layout";
import { CenterSpinner, Spinner } from "../components/ui";
import { US_STATES, STATE_NAME } from "../lib/states";
import type { GymRow } from "../lib/database.types";

export function Gyms() {
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
      .eq("status", "approved")
      .order("name")
      .then(({ data: g }) => {
        if (!active) return;
        setGyms(g ?? []);
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
    // Anti-cheat: you must be near the gym to make it home (fails closed).
    const near = await assertNearGym(gym);
    if (!near.ok) {
      setSaving(null);
      window.alert(near.error ?? "You need to be near the gym to make it home.");
      return;
    }
    await supabase
      .from("profiles")
      .update({ home_gym_id: gym.id })
      .eq("id", profile.id);
    await refreshProfile();
    setSaving(null);
    navigate("/");
  }

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return gyms.filter((g) =>
      [g.name, g.city, g.state, g.brand]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [gyms, q]);

  const stateCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of gyms) {
      const k = g.state?.trim();
      if (k) m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [gyms]);

  const stateGyms = useMemo(
    () => (openState ? gyms.filter((g) => g.state?.trim() === openState) : []),
    [gyms, openState],
  );

  function renderGym(gym: GymRow) {
    const home = gym.id === profile?.home_gym_id;
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
          </div>
          {saving === gym.id ? (
            <Spinner className="text-accent" />
          ) : home ? (
            <Check size={20} className="shrink-0 text-accent" />
          ) : null}
        </button>
      </li>
    );
  }

  return (
    <div>
      <AppHeader
        title={openState ? STATE_NAME[openState] ?? openState : "Gyms"}
        subtitle={openState ? "Browse & switch" : "Pick a state"}
        right={
          openState ? (
            <button
              onClick={() => setOpenState(null)}
              aria-label="Back to states"
              className="rounded-full p-1 text-muted transition hover:text-chalk"
            >
              <ChevronLeft size={24} />
            </button>
          ) : undefined
        }
      />

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
      ) : q ? (
        searchResults.length === 0 ? (
          <p className="mt-8 px-5 text-center text-faint">No gyms found.</p>
        ) : (
          <ul className="flex flex-col gap-2 px-5">
            {searchResults.map(renderGym)}
          </ul>
        )
      ) : openState ? (
        stateGyms.length === 0 ? (
          <p className="mt-8 px-5 text-center text-faint">
            No gyms here yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 px-5">
            {stateGyms.map(renderGym)}
          </ul>
        )
      ) : (
        <ul className="flex flex-col gap-2 px-5">
          {US_STATES.map((s) => {
            const n = stateCounts[s.code] ?? 0;
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
      <div className="h-6" />
    </div>
  );
}
