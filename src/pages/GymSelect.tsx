import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, MapPin, Search } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { CenterSpinner, Spinner } from "../components/ui";
import { STATE_NAME } from "../lib/states";
import type { GymRow } from "../lib/database.types";

/** ISO alpha-2 -> emoji flag. */
function flagEmoji(cc: string): string {
  if (!cc || cc.length !== 2) return "🏳️";
  return cc
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function GymSelect() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [openCountry, setOpenCountry] = useState<string | null>(null);
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

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return gyms.filter((g) =>
      [g.name, g.city, g.state, g.country]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [gyms, q]);

  // Country → state → gym.
  const countryList = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    for (const g of gyms) {
      const cc = (g.cc ?? "xx").toLowerCase();
      const e = m.get(cc) ?? { name: g.country ?? "Other", count: 0 };
      e.count += 1;
      m.set(cc, e);
    }
    return [...m.entries()]
      .map(([cc, v]) => ({ cc, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [gyms]);

  const statesInCountry = useMemo(() => {
    if (!openCountry) return [];
    const m = new Map<string, number>();
    for (const g of gyms) {
      if ((g.cc ?? "xx").toLowerCase() !== openCountry) continue;
      const s = g.state?.trim();
      if (s) m.set(s, (m.get(s) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) =>
        (STATE_NAME[a.code] ?? a.code).localeCompare(STATE_NAME[b.code] ?? b.code),
      );
  }, [gyms, openCountry]);

  const countryGyms = useMemo(
    () =>
      openCountry
        ? gyms.filter((g) => (g.cc ?? "xx").toLowerCase() === openCountry)
        : [],
    [gyms, openCountry],
  );

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

  const title = openState
    ? STATE_NAME[openState] ?? openState
    : openCountry
      ? countryList.find((c) => c.cc === openCountry)?.name ?? "Choose your gym"
      : "Choose your gym";
  const subtitle = openState
    ? "Pick your home gym to see its routes."
    : openCountry
      ? statesInCountry.length > 0
        ? "Pick your state."
        : "Pick your home gym."
      : "Pick your country, then your gym.";

  function goBack() {
    if (openState) setOpenState(null);
    else if (openCountry) setOpenCountry(null);
    else navigate(-1);
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="px-5 py-4">
        <div className="flex items-center gap-2">
          {openState || openCountry || profile?.home_gym_id ? (
            <button
              onClick={goBack}
              aria-label="Back"
              className="-ml-2 rounded-full p-1 text-muted transition hover:text-chalk"
            >
              <ChevronLeft size={24} />
            </button>
          ) : null}
          <h1 className="text-2xl font-extrabold text-chalk">{title}</h1>
        </div>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
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
            placeholder="Search by gym or city"
            className="h-12 w-full rounded-2xl border border-border bg-surface-2 pl-11 pr-4 text-chalk placeholder:text-faint outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {loading ? (
          <CenterSpinner />
        ) : q ? (
          searchResults.length === 0 ? (
            <p className="mt-8 text-center text-faint">No gyms found.</p>
          ) : (
            <ul className="flex flex-col gap-2 pb-4">
              {searchResults.map(renderGym)}
            </ul>
          )
        ) : openState ? (
          stateGyms.length === 0 ? (
            <p className="mt-8 text-center text-faint">No gyms here yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 pb-4">
              {stateGyms.map(renderGym)}
            </ul>
          )
        ) : openCountry ? (
          // Countries with states (e.g. US) drill into states; others list gyms.
          statesInCountry.length > 0 ? (
            <ul className="flex flex-col gap-2 pb-4">
              {statesInCountry.map((s) => (
                <li key={s.code}>
                  <button
                    onClick={() => setOpenState(s.code)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-faint"
                  >
                    <span className="font-semibold text-chalk">
                      {STATE_NAME[s.code] ?? s.code}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-accent">
                        {s.count} {s.count === 1 ? "gym" : "gyms"}
                      </span>
                      <ChevronRight size={18} className="text-faint" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col gap-2 pb-4">
              {countryGyms.map(renderGym)}
            </ul>
          )
        ) : (
          <ul className="flex flex-col gap-2 pb-4">
            {countryList.map((c) => (
              <li key={c.cc}>
                <button
                  onClick={() => setOpenCountry(c.cc)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-faint"
                >
                  <span className="flex items-center gap-2.5 font-semibold text-chalk">
                    <span className="text-xl leading-none">
                      {flagEmoji(c.cc)}
                    </span>
                    {c.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-accent">
                      {c.count} {c.count === 1 ? "gym" : "gyms"}
                    </span>
                    <ChevronRight size={18} className="text-faint" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
