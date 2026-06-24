import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Heart, Settings as SettingsIcon, Trophy, User } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AppHeader } from "../components/Layout";
import { Button, CenterSpinner } from "../components/ui";
import { RouteCard } from "../components/RouteCard";
import { fetchBookmarkedRouteIds } from "../lib/bookmarks";
import { fetchRoutesByIds, type RouteWithStats } from "../lib/routes";

type Tab = "sends" | "projects" | "favorites";

const TABS: { key: Tab; label: string; Icon: typeof Trophy }[] = [
  { key: "sends", label: "Sends", Icon: Trophy },
  { key: "projects", label: "Projects", Icon: Bookmark },
  { key: "favorites", label: "Favorites", Icon: Heart },
];

export function Profile() {
  const { profile, session, signOut } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";

  const [gymName, setGymName] = useState<string | null>(null);
  const [sendCount, setSendCount] = useState<number | null>(null);
  const [gradeCount, setGradeCount] = useState<number | null>(null);

  const [tab, setTab] = useState<Tab>("sends");
  const [lists, setLists] = useState<Record<Tab, RouteWithStats[]>>({
    sends: [],
    projects: [],
    favorites: [],
  });
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());
  const [listLoading, setListLoading] = useState(false);

  // Header stats + home gym name.
  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      if (profile.home_gym_id) {
        const { data } = await supabase
          .from("gyms")
          .select("name")
          .eq("id", profile.home_gym_id)
          .maybeSingle();
        if (active) setGymName(data?.name ?? null);
      }
      const sends = await supabase
        .from("sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id);
      if (active) setSendCount(sends.count ?? 0);
      const grades = await supabase
        .from("grades")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id);
      if (active) setGradeCount(grades.count ?? 0);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  // Lazy-load each tab's routes the first time it's opened.
  useEffect(() => {
    if (!profile || loadedTabs.has(tab)) return;
    let active = true;
    setListLoading(true);
    (async () => {
      let ids: string[] = [];
      if (tab === "sends") {
        const { data } = await supabase
          .from("sends")
          .select("route_id, created_at")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });
        ids = (data ?? []).map((s) => s.route_id);
      } else {
        ids = await fetchBookmarkedRouteIds(
          profile.id,
          tab === "projects" ? "project" : "favorite",
        );
      }
      const routes = await fetchRoutesByIds(ids);
      if (!active) return;
      setLists((prev) => ({ ...prev, [tab]: routes }));
      setLoadedTabs((prev) => new Set(prev).add(tab));
      setListLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [tab, profile, loadedTabs]);

  const current = useMemo(() => lists[tab], [lists, tab]);

  return (
    <div>
      <AppHeader
        title="Profile"
        right={
          <button
            onClick={() => navigate("/settings")}
            aria-label="Settings"
            className="rounded-full p-2 text-muted transition hover:text-chalk"
          >
            <SettingsIcon size={22} />
          </button>
        }
      />
      <div className="flex flex-col items-center px-5 py-4">
        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-surface-2">
          <User size={36} className="text-accent" />
        </div>
        <h2 className="text-2xl font-extrabold text-chalk">
          {profile?.display_name ?? "Climber"}
        </h2>
        <p className="mt-1 text-sm text-faint">{session?.user.email}</p>
        {gymName ? (
          <button
            onClick={() => navigate("/gyms")}
            className="mt-1 text-sm text-accent"
          >
            {gymName}
          </button>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px border-y border-border bg-border">
        <Stat label="Sends" value={sendCount} />
        <Stat label="Grades" value={gradeCount} />
        <Stat
          label="Projects"
          value={
            loadedTabs.has("projects") ? lists.projects.length : null
          }
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-semibold transition ${
              tab === key
                ? "border-b-2 border-accent text-accent"
                : "text-faint hover:text-muted"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {listLoading && !loadedTabs.has(tab) ? (
        <CenterSpinner />
      ) : current.length === 0 ? (
        <p className="px-8 py-12 text-center text-sm text-faint">
          {tab === "sends"
            ? "No sends logged yet."
            : tab === "projects"
              ? "No projects saved. Tap “Save to try” on a route."
              : "No favorites yet. Tap the heart on a route you love."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-5">
          {current.map((route, i) => (
            <RouteCard key={route.id} route={route} system={system} index={i} />
          ))}
        </div>
      )}

      <div className="p-5">
        <Button variant="danger" className="w-full" onClick={signOut}>
          Log out
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-bg py-4 text-center">
      <p className="text-2xl font-extrabold text-accent">{value ?? "—"}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
