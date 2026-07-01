import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  Camera,
  Heart,
  Settings as SettingsIcon,
  Trophy,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AppHeader } from "../components/Layout";
import { Avatar } from "../components/Avatar";
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
  const { profile, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";
  const avatarRef = useRef<HTMLInputElement>(null);

  const [gymName, setGymName] = useState<string | null>(null);
  const [sendCount, setSendCount] = useState<number | null>(null);
  const [gradeCount, setGradeCount] = useState<number | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [tab, setTab] = useState<Tab>("sends");
  const [lists, setLists] = useState<Record<Tab, RouteWithStats[]>>({
    sends: [],
    projects: [],
    favorites: [],
  });
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());
  const [listLoading, setListLoading] = useState(false);

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
      const friends = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .eq("status", "accepted");
      if (active) setFriendCount(friends.count ?? 0);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

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

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !profile) return;
    setUploading(true);
    try {
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, f, { contentType: f.type, upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data
        .publicUrl;
      await updateProfile({ avatar_url: url });
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not upload photo.",
      );
    } finally {
      setUploading(false);
    }
  }

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
        <input
          ref={avatarRef}
          type="file"
          accept="image/*"
          onChange={onPickAvatar}
          className="hidden"
        />
        <button
          onClick={() => avatarRef.current?.click()}
          className="relative mb-3 rounded-full"
          aria-label="Change photo"
        >
          <Avatar
            name={profile?.display_name}
            url={profile?.avatar_url}
            size={88}
          />
          <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-bg ring-4 ring-bg">
            {uploading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Camera size={16} />
            )}
          </span>
        </button>
        <h2 className="text-2xl font-extrabold text-chalk">
          {profile?.display_name ?? "Climber"}
        </h2>
        {profile?.username ? (
          <p className="mt-0.5 text-sm text-muted">@{profile.username}</p>
        ) : (
          <button
            onClick={() => navigate("/settings")}
            className="mt-0.5 text-sm text-accent"
          >
            Set a username
          </button>
        )}
        {gymName ? (
          <button
            onClick={() => navigate("/gyms")}
            className="mt-1 text-sm text-faint"
          >
            {gymName}
          </button>
        ) : null}

        <Button
          variant="secondary"
          className="mt-4 px-6"
          onClick={() => navigate("/friends")}
        >
          <UserPlus size={16} className="mr-1.5" /> Friends
          {friendCount ? ` · ${friendCount}` : ""}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-5">
        <Stat label="Sends" value={sendCount} />
        <Stat label="Grades" value={gradeCount} />
        <Stat
          label="Projects"
          value={loadedTabs.has("projects") ? lists.projects.length : null}
        />
      </div>

      {/* Tabs — soft segmented */}
      <div className="px-5 py-4">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition ${
                tab === key ? "bg-accent text-bg" : "text-muted hover:text-chalk"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
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
        <div className="flex flex-col gap-4 px-5 pb-6">
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
    <div className="rounded-2xl bg-surface py-4 text-center shadow-card">
      <p className="text-2xl font-extrabold text-accent">{value ?? "—"}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
