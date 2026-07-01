import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Plus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchActiveRoutes, fetchRoute, type RouteWithStats } from "../lib/routes";
import { fetchNotifications } from "../lib/notifications";
import {
  CLIMB_TYPES,
  climbTypeLabel,
  holdHex,
  type ClimbType,
} from "../lib/constants";
import { RouteCard } from "../components/RouteCard";
import { GradePicker } from "../components/GradePicker";
import { AppHeader } from "../components/Layout";
import { Button, CenterSpinner } from "../components/ui";

type Sort = "newest" | "graded" | "sends";

const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "graded", label: "Most graded" },
  { key: "sends", label: "Most sends" },
];

export function Feed() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const gymId = profile?.home_gym_id ?? null;
  const system = profile?.grade_system ?? "american";
  const [gymName, setGymName] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [routes, setRoutes] = useState<RouteWithStats[]>([]);
  const [myGrades, setMyGrades] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  // Quick-grade sheet state.
  const [gradingRoute, setGradingRoute] = useState<RouteWithStats | null>(null);
  const [draftGrade, setDraftGrade] = useState<number | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [section, setSection] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("newest");
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

  const visible = useMemo(() => {
    let list =
      section === "All"
        ? typeFiltered
        : typeFiltered.filter((r) => r.wall_section === section);
    list = [...list];
    if (sort === "graded") {
      list.sort((a, b) => b.gradeValues.length - a.gradeValues.length);
    } else if (sort === "sends") {
      list.sort((a, b) => b.sendCount - a.sendCount);
    } else {
      list.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    return list;
  }, [typeFiltered, section, sort]);

  return (
    <div>
      <AppHeader
        subtitle="Routes at"
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

      {/* Bouldering / Top Rope tabs */}
      <div className="flex border-b border-border px-5">
        {CLIMB_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setTab(t.value);
              setSection("All");
            }}
            className={`relative flex-1 pb-3 pt-1 text-center text-sm font-semibold transition ${
              tab === t.value ? "text-chalk" : "text-faint hover:text-muted"
            }`}
          >
            {t.value === "boulder" ? "Bouldering" : "Top Rope"}
            {tab === t.value ? (
              <span className="absolute inset-x-0 -bottom-px mx-auto h-0.5 w-12 rounded-full bg-accent" />
            ) : null}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 px-5 py-3">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
                section === s
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface text-muted hover:text-chalk"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                sort === s.key
                  ? "bg-surface-2 text-chalk"
                  : "text-faint hover:text-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
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
              onGrade={openGrade}
            />
          ))}
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
