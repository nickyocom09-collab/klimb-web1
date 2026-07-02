import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Check, Plus, Search, X, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchActiveRoutes, type RouteWithStats } from "../lib/routes";
import { communityGrade, formatGrade } from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { toggleBookmark } from "../lib/bookmarks";
import { AppHeader } from "../components/Layout";
import { Button, CenterSpinner } from "../components/ui";
import { GradePicker } from "../components/GradePicker";
import type { SendType } from "../lib/database.types";

type Outcome = "flash" | "send" | "project";

const OUTCOMES: {
  value: Outcome;
  label: string;
  hint: string;
  Icon: typeof Zap;
}[] = [
  { value: "flash", label: "Flash", hint: "First try", Icon: Zap },
  { value: "send", label: "Send", hint: "Topped it", Icon: Check },
  { value: "project", label: "Project", hint: "Working on it", Icon: Bookmark },
];

// Fast-log: the app's main loop. Pick a route at your home gym, say how it
// went, optionally drop a felt grade (which feeds the community grade) and a
// note. "Project" doesn't create a send — it marks the route as one you're
// working on (a bookmark), so it shows up on your projects list.
export function LogClimb() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";

  const [routes, setRoutes] = useState<RouteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // The route being logged. null = still on the picker.
  const [selected, setSelected] = useState<RouteWithStats | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [feltGrade, setFeltGrade] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.home_gym_id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchActiveRoutes(profile.home_gym_id).then((rs) => {
      if (!active) return;
      setRoutes(rs);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [profile?.home_gym_id]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return routes;
    return routes.filter((r) =>
      [r.hold_color, r.wall_section, climbTypeLabel(r.climbing_type)].some((f) =>
        f.toLowerCase().includes(q),
      ),
    );
  }, [routes, q]);

  function openLog(r: RouteWithStats) {
    setSelected(r);
    setOutcome(null);
    setFeltGrade(null);
    setNote("");
  }

  async function save() {
    if (!selected || !profile || !outcome) return;
    setSaving(true);
    const routeId = selected.id;

    // A felt grade feeds the community grade no matter the outcome.
    if (feltGrade !== null) {
      await supabase.from("grades").upsert(
        {
          route_id: routeId,
          user_id: profile.id,
          grade: feltGrade,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "route_id,user_id" },
      );
    }

    if (outcome === "project") {
      // Not sent yet — keep it on the projects list, no send row.
      await toggleBookmark(profile.id, routeId, "project", false);
    } else {
      const trimmed = note.trim();
      await supabase.from("sends").upsert(
        {
          route_id: routeId,
          user_id: profile.id,
          send_type: outcome as SendType,
          note: trimmed.length ? trimmed : null,
        },
        { onConflict: "route_id,user_id" },
      );
    }

    setSaving(false);
    navigate(`/route/${routeId}`);
  }

  if (!profile?.home_gym_id) {
    return (
      <div>
        <AppHeader title="Log a climb" subtitle="Your gym" />
        <div className="flex flex-col items-center gap-4 px-8 py-20 text-center">
          <p className="text-faint">Pick a home gym to start logging climbs.</p>
          <Button onClick={() => navigate("/gym/select")}>Choose a gym</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader
        title="Log a climb"
        subtitle="Pick what you climbed"
        right={
          <button
            onClick={() => navigate("/add")}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-bg shadow-glow transition active:scale-95"
          >
            <Plus size={16} /> Add route
          </button>
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
            placeholder="Search color, wall, or type"
            className="h-12 w-full rounded-2xl border border-border bg-surface-2 pl-11 pr-4 text-chalk placeholder:text-faint outline-none focus:border-accent"
          />
        </div>
      </div>

      {loading ? (
        <CenterSpinner />
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
          <p className="text-faint">
            {q ? "No routes match that." : "No active routes here yet."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 px-5">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => openLog(r)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left transition hover:border-faint"
              >
                <img
                  src={r.photo_url}
                  alt={`${r.hold_color} route on ${r.wall_section}`}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold text-chalk">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-white/10"
                      style={{ backgroundColor: holdHex(r.hold_color) }}
                    />
                    <span className="truncate">{r.hold_color}</span>
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {r.wall_section} · {climbTypeLabel(r.climbing_type)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-extrabold leading-none text-accent">
                    {formatGrade(
                      communityGrade(r.gradeValues),
                      r.climbing_type,
                      system,
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-faint">
                    {r.sendCount} send{r.sendCount === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="px-5 py-5">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => navigate("/add")}
        >
          <Plus size={18} className="mr-2" /> Can't find it? Add the route
        </Button>
      </div>

      {/* Log sheet */}
      {selected ? (
        <div className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4">
          <div className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card">
            {/* Route header */}
            <div className="mb-4 flex items-center gap-3">
              <img
                src={selected.photo_url}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-chalk">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white/10"
                    style={{ backgroundColor: holdHex(selected.hold_color) }}
                  />
                  <span className="truncate">{selected.hold_color}</span>
                </p>
                <p className="truncate text-sm text-muted">
                  {selected.wall_section} ·{" "}
                  {climbTypeLabel(selected.climbing_type)}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="rounded-full p-1 text-faint transition hover:text-chalk"
              >
                <X size={22} />
              </button>
            </div>

            {/* Outcome */}
            <div className="grid grid-cols-3 gap-2">
              {OUTCOMES.map(({ value, label, hint, Icon }) => {
                const on = outcome === value;
                return (
                  <button
                    key={value}
                    onClick={() => setOutcome(value)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border py-3 transition ${
                      on
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface-2 text-muted hover:text-chalk"
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-sm font-bold">{label}</span>
                    <span className="text-[10px] text-faint">{hint}</span>
                  </button>
                );
              })}
            </div>

            {/* Felt grade */}
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
                Felt grade
                <span className="ml-1 font-normal normal-case text-faint">
                  (optional)
                </span>
              </h3>
              <GradePicker
                value={feltGrade}
                onChange={setFeltGrade}
                climbingType={selected.climbing_type}
                system={system}
              />
            </div>

            {/* Note */}
            <div className="mt-4">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional) — how'd it feel?"
                maxLength={280}
                className="min-h-[60px] w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-chalk placeholder:text-faint outline-none focus:border-accent"
              />
            </div>

            <Button
              className="mt-4 w-full"
              disabled={!outcome}
              loading={saving}
              onClick={save}
            >
              {outcome === "project" ? "Save to projects" : "Log it"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
