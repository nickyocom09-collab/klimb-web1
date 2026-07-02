import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, LayoutGrid, Plus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchActiveRoutes, fetchRoute, type RouteWithStats } from "../lib/routes";
import { communityGrade, formatGrade } from "../lib/grades";
import { fetchNotifications } from "../lib/notifications";
import {
  CLIMB_TYPES,
  climbTypeLabel,
  holdHex,
  type ClimbType,
} from "../lib/constants";
import { RouteCard } from "../components/RouteCard";
import { GradePicker } from "../components/GradePicker";
import { Dropdown } from "../components/Dropdown";
import { AppHeader } from "../components/Layout";
import { Button, CenterSpinner } from "../components/ui";

type Sort = "newest" | "trending" | "ungraded" | "graded" | "sends" | "fun";

const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "trending", label: "Trending" },
  { key: "ungraded", label: "Needs grades" },
  { key: "graded", label: "Most graded" },
  { key: "sends", label: "Most sends" },
  { key: "fun", label: "Most fun" },
];

const UNGRADED = "Ungraded";

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
  const [unread, setUnread] = useState(0);
  const [routes, setRoutes] = useState<RouteWithStats[]>([]);
  const [myGrades, setMyGrades] = useState<Map<string, number>>(new Map());
  const [authorNames, setAuthorNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  // Quick-grade sheet state.
  const [gradingRoute, setGradingRoute] = useState<RouteWithStats | null>(null);
  const [draftGrade, setDraftGrade] = useState<number | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [section, setSection] = useState<string>("All");
  const [color, setColor] = useState<string>("All");
  const [gradeFilter, setGradeFilter] = useState<string>("All");
  const [setter, setSetter] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("newest");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [tab, setTab] = useState<ClimbType>(
    profile?.default_climb_filter === "toprope" ? "toprope" : "boulder",
  );

  // Sync the default tab once the profile preference loads. "all" defaults to
  // bouldering since the feed is now split into two type-specific tabs.
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

  // Unread notification badge.
  useEffect(() => {
    if (!profile) return;
    let active = true;
    fetchNotifications(
      profile.id,
      profile.home_gym_id,
      profile.notifications_seen_at,
    ).then((list) => {
      if (active) setUnread(list.filter((n) => n.unread).length);
    });
    return () => {
      active = false;
    };
  }, [profile]);

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
          const { data } = await supabase
            .from("grades")
            .select("route_id, grade")
            .eq("user_id", profile.id)
            .in("route_id", ids);
          if (active) {
            setMyGrades(
              new Map((data ?? []).map((g) => [g.route_id, g.grade])),
            );
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
    // Optimistic-ish: refetch this one route's stats so the community grade
    // and distribution update immediately.
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

  const sections = useMemo(() => {
    const set = new Set(typeFiltered.map((r) => r.wall_section));
    return ["All", ...Array.from(set).sort()];
  }, [typeFiltered]);

  const colors = useMemo(() => {
    const set = new Set(typeFiltered.map((r) => r.hold_color));
    return ["All", ...Array.from(set).sort()];
  }, [typeFiltered]);

  // Community-grade label per route, reused by the filter and its options.
  const gradeLabelOf = (r: RouteWithStats) => {
    const g = communityGrade(r.gradeValues);
    return g === null ? UNGRADED : formatGrade(g, r.climbing_type, system);
  };

  const gradeOptions = useMemo(() => {
    const byLabel = new Map<string, number>();
    for (const r of typeFiltered) {
      const g = communityGrade(r.gradeValues);
      byLabel.set(gradeLabelOf(r), g ?? Number.MAX_SAFE_INTEGER);
    }
    const labels = [...byLabel.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([label]) => label);
    return ["All", ...labels];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFiltered, system]);

  const setterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const r of typeFiltered) {
      if (r.created_by) {
        const n = authorNames.get(r.created_by);
        if (n) names.add(n);
      }
    }
    return ["All", ...Array.from(names).sort()];
  }, [typeFiltered, authorNames]);

  // Wall sections grouped for the gym-layout sheet.
  const layoutSections = useMemo(() => {
    const map = new Map<string, { count: number; colors: Set<string> }>();
    for (const r of typeFiltered) {
      const cur = map.get(r.wall_section) ?? { count: 0, colors: new Set() };
      cur.count += 1;
      cur.colors.add(r.hold_color);
      map.set(r.wall_section, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, count: v.count, colors: [...v.colors] }))
      .sort((a, b) => b.count - a.count);
  }, [typeFiltered]);

  const visible = useMemo(() => {
    let list = typeFiltered;
    if (section !== "All") list = list.filter((r) => r.wall_section === section);
    if (color !== "All") list = list.filter((r) => r.hold_color === color);
    if (gradeFilter !== "All")
      list = list.filter((r) => gradeLabelOf(r) === gradeFilter);
    if (setter !== "All")
      list = list.filter(
        (r) => r.created_by && authorNames.get(r.created_by) === setter,
      );
    list = [...list];
    const newest = (a: RouteWithStats, b: RouteWithStats) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "graded") {
      list.sort((a, b) => b.gradeValues.length - a.gradeValues.length);
    } else if (sort === "sends") {
      list.sort((a, b) => b.sendCount - a.sendCount);
    } else if (sort === "trending") {
      // Hottest first: most sends + grades in the last 7 days.
      list.sort(
        (a, b) =>
          b.recentActivity - a.recentActivity ||
          b.sendCount - a.sendCount ||
          newest(a, b),
      );
    } else if (sort === "fun") {
      list.sort((a, b) => (b.funAvg ?? 0) - (a.funAvg ?? 0) || newest(a, b));
    } else if (sort === "ungraded") {
      // Fewest grades first (0 = brand new / unrated), newest breaks ties —
      // exactly the "walked up to a route nobody's rated" case.
      list.sort(
        (a, b) => a.gradeValues.length - b.gradeValues.length || newest(a, b),
      );
    } else {
      list.sort(newest);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFiltered, section, color, gradeFilter, setter, sort, authorNames, system]);

  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Newest";

  return (
    <div>
      <AppHeader
        subtitle={visiting ? "Visiting" : "Routes at"}
        title={gymName ?? "your gym"}
        right={
          <button
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
            className="relative rounded-full p-2 text-muted transition hover:text-chalk"
          >
            <Bell size={22} />
            {unread > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
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

      {/* Bouldering / Top Rope — soft segmented control, no hard lines */}
      <div className="px-5 pb-3 pt-1">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          {CLIMB_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTab(t.value);
                setSection("All");
                setColor("All");
                setGradeFilter("All");
                setSetter("All");
              }}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                tab === t.value
                  ? "bg-accent text-bg shadow"
                  : "text-muted hover:text-chalk"
              }`}
            >
              {t.value === "boulder" ? "Bouldering" : "Top Rope"}
            </button>
          ))}
        </div>

        {/* Filters as clean dropdowns */}
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          <button
            onClick={() => setLayoutOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold text-chalk transition active:scale-[0.97]"
          >
            <LayoutGrid size={15} className="text-accent" /> Layout
          </button>
          <Dropdown
            label="Wall"
            value={section}
            options={sections}
            onChange={setSection}
          />
          <Dropdown
            label="Grade"
            value={gradeFilter}
            options={gradeOptions}
            onChange={setGradeFilter}
          />
          <Dropdown
            label="Color"
            value={color}
            options={colors}
            onChange={setColor}
          />
          <Dropdown
            label="Setter"
            value={setter}
            options={setterOptions}
            onChange={setSetter}
          />
          <Dropdown
            label="Sort"
            value={sortLabel}
            options={SORTS.map((s) => s.label)}
            onChange={(l) => {
              const found = SORTS.find((s) => s.label === l);
              if (found) setSort(found.key);
            }}
            align="right"
          />
        </div>
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
        <div className="flex flex-col gap-4 px-5 pb-6">
          {visible.map((route, i) => (
            <RouteCard
              key={route.id}
              route={route}
              system={system}
              index={i}
              myGrade={myGrades.get(route.id) ?? null}
              authorName={
                route.created_by ? authorNames.get(route.created_by) ?? null : null
              }
              onGrade={openGrade}
            />
          ))}
        </div>
      )}

      {/* Gym layout — schematic wall map, tap a wall to filter the feed. */}
      {layoutOpen ? (
        <div
          className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4"
          onClick={() => setLayoutOpen(false)}
        >
          <div
            className="max-h-[75vh] w-full animate-fade-up overflow-y-auto rounded-3xl border border-border bg-surface p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-chalk">
                <LayoutGrid size={18} className="text-accent" /> Gym layout
              </h3>
              <button
                onClick={() => setLayoutOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-faint transition hover:text-chalk"
              >
                <X size={22} />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted">
              {gymName ?? "Your gym"} · tap a wall to see its routes
            </p>

            <button
              onClick={() => {
                setSection("All");
                setLayoutOpen(false);
              }}
              className={`mb-2 w-full rounded-2xl px-4 py-3 text-left transition active:scale-[0.99] ${
                section === "All"
                  ? "bg-accent/15 ring-1 ring-accent"
                  : "bg-surface-2"
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="font-bold text-chalk">All walls</span>
                <span className="text-sm text-muted">
                  {typeFiltered.length} routes
                </span>
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              {layoutSections.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => {
                    setSection(s.name);
                    setLayoutOpen(false);
                  }}
                  style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
                  className={`animate-fade-up rounded-2xl px-4 py-4 text-left transition active:scale-[0.98] ${
                    section === s.name
                      ? "bg-accent/15 ring-1 ring-accent"
                      : "bg-surface-2"
                  } ${i === 0 ? "col-span-2" : ""}`}
                >
                  <p className="font-bold text-chalk">{s.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.count} route{s.count === 1 ? "" : "s"}
                  </p>
                  <span className="mt-2 flex items-center gap-1">
                    {s.colors.slice(0, 6).map((c) => (
                      <span
                        key={c}
                        className="h-2.5 w-2.5 rounded-full border border-white/10"
                        style={{ backgroundColor: holdHex(c) }}
                      />
                    ))}
                    {s.colors.length > 6 ? (
                      <span className="text-[10px] text-faint">
                        +{s.colors.length - 6}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

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
