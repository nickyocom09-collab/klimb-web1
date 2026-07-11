import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Map as MapIcon, Plus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchActiveRoutes, fetchRoute, type RouteWithStats } from "../lib/routes";
import {
  communityGrade,
  formatGradeStyled,
  type GradeSystem,
} from "../lib/grades";
import { CLIMB_TYPES, climbTypeLabel, holdHex, type ClimbType } from "../lib/constants";
import { RouteCard } from "../components/RouteCard";
import { GradePicker } from "../components/GradePicker";
import { AppHeader } from "../components/Layout";
import { Button, CenterSpinner, SlideTabs } from "../components/ui";

// The feed is intentionally simple: pick bouldering or top rope, optionally
// narrow to a hold color, newest first. That's it.
export function Feed() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  // A "visiting" gym temporarily retargets the home feed without changing home.
  const gymId = profile?.visiting_gym_id ?? profile?.home_gym_id ?? null;
  const visiting =
    !!profile?.visiting_gym_id &&
    profile.visiting_gym_id !== profile.home_gym_id;
  const system = profile?.grade_system ?? "american";

  async function clearVisiting() {
    if (!profile) return;
    await supabase
      .from("profiles")
      .update({ visiting_gym_id: null })
      .eq("id", profile.id);
    await refreshProfile();
  }
  const [gymName, setGymName] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteWithStats[]>([]);
  const [myGrades, setMyGrades] = useState<Map<string, number>>(new Map());
  // Solo-safe home sections: my open projects here, and (social, optional)
  // how many climbers are projecting each route.
  const [myProjects, setMyProjects] = useState<Set<string>>(new Set());
  const [mySends, setMySends] = useState<Set<string>>(new Set());
  const [projCounts, setProjCounts] = useState<Map<string, number>>(new Map());
  const [authorNames, setAuthorNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  // Quick-grade sheet state.
  const [gradingRoute, setGradingRoute] = useState<RouteWithStats | null>(null);
  const [draftGrade, setDraftGrade] = useState<number | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [tab, setTab] = useState<ClimbType>(
    profile?.default_climb_filter === "toprope" ? "toprope" : "boulder",
  );

  // Sync the default tab once the profile preference loads. "all" defaults to
  // bouldering since the feed is split into two type-specific tabs.
  useEffect(() => {
    if (profile?.default_climb_filter) {
      setTab(profile.default_climb_filter === "toprope" ? "toprope" : "boulder");
    }
  }, [profile?.default_climb_filter]);

  useEffect(() => {
    if (!gymId) return;
    supabase
      .from("gyms")
      .select("name")
      .eq("id", gymId)
      .maybeSingle()
      .then(({ data }) => setGymName(data?.name ?? null));
  }, [gymId]);

  useEffect(() => {
    if (!gymId || !profile) return;
    let active = true;
    setLoading(true);
    fetchActiveRoutes(gymId)
      .then(async (r) => {
        if (!active) return;
        setRoutes(r);
        // Which of these routes the current user has already graded.
        const ids = r.map((x) => x.id);
        if (ids.length > 0) {
          const [{ data }, { data: bms }, { data: sent }] = await Promise.all([
            supabase
              .from("grades")
              .select("route_id, grade")
              .eq("user_id", profile.id)
              .in("route_id", ids),
            supabase
              .from("bookmarks")
              .select("route_id, user_id")
              .eq("kind", "project")
              .in("route_id", ids),
            supabase
              .from("sends")
              .select("route_id")
              .eq("user_id", profile.id)
              .neq("send_type", "attempt")
              .in("route_id", ids),
          ]);
          if (active) {
            setMyGrades(
              new Map((data ?? []).map((g) => [g.route_id, g.grade])),
            );
            const mine = new Set<string>();
            const counts = new Map<string, number>();
            for (const b of bms ?? []) {
              if (b.user_id === profile.id) mine.add(b.route_id);
              else counts.set(b.route_id, (counts.get(b.route_id) ?? 0) + 1);
            }
            setMyProjects(mine);
            setProjCounts(counts);
            setMySends(new Set((sent ?? []).map((s) => s.route_id)));
          }
        }
        // Author display names for the "posted by" strip.
        const authorIds = [
          ...new Set(r.map((x) => x.created_by).filter(Boolean)),
        ] as string[];
        if (authorIds.length > 0) {
          const { data: people } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", authorIds);
          if (active) {
            setAuthorNames(
              new Map((people ?? []).map((p) => [p.id, p.display_name])),
            );
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gymId, profile]);

  function openGrade(route: RouteWithStats) {
    setGradingRoute(route);
    setDraftGrade(myGrades.get(route.id) ?? null);
  }

  async function submitGrade() {
    if (!gradingRoute || !profile || draftGrade === null) return;
    setSavingGrade(true);
    const routeId = gradingRoute.id;
    await supabase.from("grades").upsert(
      {
        route_id: routeId,
        user_id: profile.id,
        grade: draftGrade,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "route_id,user_id" },
    );
    // Refetch this one route's stats so the community grade updates immediately.
    const fresh = await fetchRoute(routeId);
    if (fresh) {
      setRoutes((prev) => prev.map((r) => (r.id === routeId ? fresh : r)));
    }
    setMyGrades((prev) => new Map(prev).set(routeId, draftGrade));
    setSavingGrade(false);
    setGradingRoute(null);
  }

  const typeFiltered = useMemo(
    () => routes.filter((r) => r.climbing_type === tab),
    [routes, tab],
  );

  const visible = useMemo(
    () =>
      // Newest first — the one and only ordering.
      [...typeFiltered].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [typeFiltered],
  );

  // My open projects at this gym — "pick up where you left off".
  const projectRoutes = useMemo(
    () => typeFiltered.filter((r) => myProjects.has(r.id) && !mySends.has(r.id)),
    [typeFiltered, myProjects, mySends],
  );
  // Routes with 0–1 grades — your single opinion genuinely moves the needle.
  const needsGrades = useMemo(
    () =>
      typeFiltered
        .filter((r) => r.gradeValues.length <= 1 && !myGrades.has(r.id))
        .slice(0, 12),
    [typeFiltered, myGrades],
  );
  // Social bonus layer: what other climbers are projecting. Hidden entirely
  // when nobody is — never render a dead social block.
  const gymProjects = useMemo(
    () =>
      typeFiltered
        .filter((r) => (projCounts.get(r.id) ?? 0) > 0)
        .sort(
          (a, b) => (projCounts.get(b.id) ?? 0) - (projCounts.get(a.id) ?? 0),
        )
        .slice(0, 12),
    [typeFiltered, projCounts],
  );

  return (
    <div>
      <AppHeader
        subtitle={visiting ? "Visiting" : "Routes at"}
        title={gymName ?? "your gym"}
        right={
          <button
            onClick={() => navigate("/map")}
            aria-label="Find gyms on the map"
            className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-2 text-xs font-semibold text-chalk transition active:scale-95"
          >
            <MapIcon size={15} className="text-accent" /> Map
          </button>
        }
      />

      {visiting ? (
        <button
          onClick={clearVisiting}
          className="mx-5 mt-1 flex w-[calc(100%-2.5rem)] items-center justify-between rounded-2xl bg-accent/10 px-4 py-2.5 text-sm text-accent transition hover:bg-accent/15"
        >
          <span className="font-semibold">
            You're browsing a gym you're visiting
          </span>
          <span className="font-semibold underline">Back to home</span>
        </button>
      ) : null}

      {/* Bouldering / Top Rope — sliding segmented control */}
      <div className="px-5 pb-3 pt-1">
        <SlideTabs
          value={tab}
          onChange={setTab}
          options={CLIMB_TYPES.map((t) => ({
            value: t.value,
            label: t.value === "boulder" ? "Bouldering" : "Top Rope",
          }))}
        />
      </div>

      {loading ? (
        <CenterSpinner />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="text-faint">
            No active routes here yet. Add the first one.
          </p>
          <Link to="/add">
            <Button>
              <Plus size={18} className="mr-2" /> Add a route
            </Button>
          </Link>
        </div>
      ) : (
        // Keyed by tab so switching types re-runs the entrance animation.
        <div key={tab} className="flex flex-col gap-5 px-5 pb-6">
          {/* Solo-first sections. Each hides entirely when it has nothing. */}
          {projectRoutes.length > 0 ? (
            <Strip
              title="Pick up where you left off"
              routes={projectRoutes}
              system={system}
              caption={() => "Projecting"}
              captionTone="accent"
            />
          ) : null}

          {needsGrades.length > 0 ? (
            <Strip
              title="Needs grades"
              routes={needsGrades}
              system={system}
              caption={(r) =>
                r.gradeValues.length === 0
                  ? "Be the first to grade"
                  : "Only 1 vote so far"
              }
              captionTone="wide"
            />
          ) : null}

          {gymProjects.length > 0 ? (
            <Strip
              title="What your gym is working on"
              routes={gymProjects}
              system={system}
              caption={(r) => {
                const n = projCounts.get(r.id) ?? 0;
                return `${n} climber${n === 1 ? "" : "s"} projecting`;
              }}
              captionTone="muted"
            />
          ) : null}

          <section>
            <h2 className="mb-3 ml-1 text-sm font-semibold uppercase tracking-wide text-faint">
              Recently set
            </h2>
            <div className="flex flex-col gap-4">
              {visible.map((route, i) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  system={system}
                  index={i}
                  myGrade={myGrades.get(route.id) ?? null}
                  authorName={
                    route.created_by
                      ? authorNames.get(route.created_by) ?? null
                      : null
                  }
                  onGrade={openGrade}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Quick-grade sheet — drop your take without leaving the feed. */}
      {gradingRoute ? (
        <div className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4">
          <div className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <img
                src={gradingRoute.photo_url}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-chalk">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white/10"
                    style={{ backgroundColor: holdHex(gradingRoute.hold_color) }}
                  />
                  <span className="truncate">{gradingRoute.hold_color}</span>
                </p>
                <p className="truncate text-sm text-muted">
                  {gradingRoute.wall_section} ·{" "}
                  {climbTypeLabel(gradingRoute.climbing_type)}
                </p>
              </div>
              <button
                onClick={() => setGradingRoute(null)}
                aria-label="Close"
                className="rounded-full p-1 text-faint transition hover:text-chalk"
              >
                <X size={22} />
              </button>
            </div>

            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
              What do you think it's graded?
            </h3>
            <GradePicker
              value={draftGrade}
              onChange={setDraftGrade}
              climbingType={gradingRoute.climbing_type}
              system={system}
              gradeStyle={gradingRoute.gradingStyle}
            />
            <Button
              className="mt-4 w-full"
              disabled={draftGrade === null}
              loading={savingGrade}
              onClick={submitGrade}
            >
              {myGrades.has(gradingRoute.id) ? "Update my grade" : "Submit grade"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Horizontal scroll strip of compact route cards — used by home sections. */
function Strip({
  title,
  routes,
  system,
  caption,
  captionTone,
}: {
  title: string;
  routes: RouteWithStats[];
  system: GradeSystem;
  caption: (r: RouteWithStats) => string;
  captionTone: "accent" | "wide" | "muted";
}) {
  const toneClass =
    captionTone === "accent"
      ? "text-accent"
      : captionTone === "wide"
        ? "text-wide"
        : "text-muted";
  return (
    <section>
      <h2 className="mb-2 ml-1 text-sm font-semibold uppercase tracking-wide text-faint">
        {title}
      </h2>
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        {routes.map((r, i) => (
          <Link
            key={r.id}
            to={`/route/${r.id}`}
            style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
            className="w-32 shrink-0 animate-fade-up transition active:scale-[0.97]"
          >
            <div className="relative h-24 w-32 overflow-hidden rounded-2xl bg-surface-2 shadow-card">
              <img
                src={r.photo_url}
                alt={`${r.hold_color} route on ${r.wall_section}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-bg/80 px-2 py-0.5 text-xs font-extrabold text-accent backdrop-blur">
                {formatGradeStyled(
                  communityGrade(r.gradeValues),
                  r.climbing_type,
                  system,
                  r.gradingStyle,
                )}
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-chalk">
              <span
                className="h-2 w-2 shrink-0 rounded-full border border-white/10"
                style={{ backgroundColor: holdHex(r.hold_color) }}
              />
              <span className="truncate">{r.wall_section}</span>
            </p>
            <p className={`truncate text-[10px] ${toneClass}`}>{caption(r)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
