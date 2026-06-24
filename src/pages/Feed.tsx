import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Plus } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchActiveRoutes, type RouteWithStats } from "../lib/routes";
import { fetchNotifications } from "../lib/notifications";
import { CLIMB_TYPES, type ClimbType } from "../lib/constants";
import { RouteCard } from "../components/RouteCard";
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
  const [loading, setLoading] = useState(true);
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
    if (!gymId) return;
    let active = true;
    setLoading(true);
    fetchActiveRoutes(gymId)
      .then((r) => {
        if (active) setRoutes(r);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gymId]);

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
            <RouteCard key={route.id} route={route} system={system} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
