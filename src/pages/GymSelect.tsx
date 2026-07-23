import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, MapPin, Plus, Search, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, CenterSpinner, Input, Spinner } from "../components/ui";
import { STATE_NAME } from "../lib/states";
import { assertNearGym } from "../lib/location";
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
  const [locError, setLocError] = useState<string | null>(null);
  const [openCountry, setOpenCountry] = useState<string | null>(null);
  const [openState, setOpenState] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Suggest-a-gym sheet.
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [sgName, setSgName] = useState("");
  const [sgCity, setSgCity] = useState("");
  const [sgSaving, setSgSaving] = useState(false);
  const [sgDone, setSgDone] = useState(false);

  // Drilling into a country or state should start you at the top, not wherever
  // you'd scrolled the previous list to.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [openCountry, openState, query]);

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
    setLocError(null);
    setSaving(gym.id);
    // Anti-cheat: confirm you're actually near this gym before it becomes home.
    const near = await assertNearGym(gym);
    if (!near.ok) {
      setSaving(null);
      setLocError(near.error ?? "You need to be near the gym to set it as home.");
      return;
    }
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
      .sort((a, b) => {
        // USA always leads the list — most of Klimb's gyms are American.
        if (a.cc === "us") return -1;
        if (b.cc === "us") return 1;
        return a.name.localeCompare(b.name);
      });
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

  // Submit a gym we don't have yet. It lands as a `pending` row Nick reviews in
  // Supabase (Table editor → gyms → status = 'pending') before it goes live.
  async function submitSuggestion() {
    if (!profile || !sgName.trim()) return;
    setSgSaving(true);
    const country =
      countryList.find((c) => c.cc === openCountry)?.name ?? null;
    await supabase.from("gyms").insert({
      name: sgName.trim(),
      city: sgCity.trim() || null,
      state: openState ?? null,
      country,
      cc: openCountry ? openCountry.toUpperCase() : null,
      status: "pending",
      created_by: profile.id,
    });
    setSgSaving(false);
    setSgDone(true);
  }

  function openSuggest() {
    setSgName("");
    setSgCity("");
    setSgDone(false);
    setSuggestOpen(true);
  }

  // Show the "Don't see your gym?" prompt once you're deep enough to be looking
  // at an actual gym list (a state, or a country with no state breakdown).
  const showSuggestPrompt =
    !q && (openState !== null || (openCountry !== null && statesInCountry.length === 0));

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

      {locError ? (
        <div className="mx-5 mb-3 rounded-2xl border border-wide/40 bg-wide/10 px-4 py-3 text-sm text-wide">
          {locError}
        </div>
      ) : null}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5">
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

        {showSuggestPrompt ? (
          <button
            onClick={openSuggest}
            className="mb-6 mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 p-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
          >
            <Plus size={16} /> Don't see your gym? Add it
          </button>
        ) : null}
      </div>

      {/* Suggest-a-gym sheet */}
      {suggestOpen ? (
        <div
          className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/70 p-4"
          onClick={() => setSuggestOpen(false)}
        >
          <div
            className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-chalk">
                {sgDone ? "Thanks!" : "Suggest a gym"}
              </h3>
              <button
                onClick={() => setSuggestOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-faint hover:text-chalk"
              >
                <X size={22} />
              </button>
            </div>

            {sgDone ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted">
                  Got it — <span className="font-semibold text-chalk">{sgName.trim()}</span>{" "}
                  was submitted for review. We'll add it soon so you and others
                  can log climbs there.
                </p>
                <Button className="w-full" onClick={() => setSuggestOpen(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  Tell us the gym and we'll add it{openState ? ` in ${STATE_NAME[openState] ?? openState}` : ""}.
                </p>
                <Input
                  label="Gym name"
                  value={sgName}
                  onChange={(e) => setSgName(e.target.value)}
                  placeholder="e.g. Movement Englewood"
                />
                <Input
                  label="City (optional)"
                  value={sgCity}
                  onChange={(e) => setSgCity(e.target.value)}
                  placeholder="e.g. Denver"
                />
                <Button
                  className="mt-1 w-full"
                  loading={sgSaving}
                  disabled={sgName.trim().length < 2}
                  onClick={submitSuggestion}
                >
                  Submit gym
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
