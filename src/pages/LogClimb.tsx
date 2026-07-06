import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useAuth } from "../lib/auth";
import { fetchActiveRoutes, type RouteWithStats } from "../lib/routes";
import { communityGrade, formatGradeStyled } from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { AppHeader } from "../components/Layout";
import { Button, CenterSpinner } from "../components/ui";
import { LogSheet } from "../components/LogSheet";

// Fast-log: the app's main loop. Pick a route at your home gym, then the
// shared LogSheet (same one the route page uses) records how it went.
export function LogClimb() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";

  const [routes, setRoutes] = useState<RouteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // The route being logged. null = still on the picker.
  const [selected, setSelected] = useState<RouteWithStats | null>(null);

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
                    {formatGradeStyled(
                      communityGrade(r.gradeValues),
                      r.climbing_type,
                      system,
                      r.gradingStyle,
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

      {/* The shared log sheet — identical to the one on the route page. */}
      {selected ? (
        <LogSheet
          route={selected}
          onClose={() => setSelected(null)}
          onSaved={() => navigate(`/route/${selected.id}`)}
        />
      ) : null}
    </div>
  );
}
