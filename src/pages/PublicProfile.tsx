import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, Bookmark, Check, ChevronLeft, ChevronRight, Clock, Lock, Stamp, UserPlus, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoutesByIds, type RouteWithStats } from "../lib/routes";
import type { GradeSystem } from "../lib/grades";
import {
  acceptFriendRequest,
  addFriendById,
  friendshipStatus,
  removeFriend,
  type FriendStatus,
} from "../lib/friends";
import { blockUser, unblockUser } from "../lib/moderation";
import { Avatar } from "../components/Avatar";
import { RouteCard } from "../components/RouteCard";
import { Button, CenterSpinner, ConfirmDialog } from "../components/ui";

type PubProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  sends_public: boolean;
  projects_public: boolean;
};

export function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { profile: me } = useAuth();
  const navigate = useNavigate();
  const system = me?.grade_system ?? "american";

  const [person, setPerson] = useState<PubProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sends, setSends] = useState<RouteWithStats[]>([]);
  const [flashes, setFlashes] = useState<RouteWithStats[]>([]);
  const [projects, setProjects] = useState<RouteWithStats[]>([]);
  const [tab, setTab] = useState<"sends" | "flashes" | "projects">("sends");
  const [status, setStatus] = useState<FriendStatus>("none");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [unfriendOpen, setUnfriendOpen] = useState(false);

  const isMe = !!me && me.id === id;

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, bio, sends_public, projects_public")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      setPerson(data as PubProfile | null);

      // Have I blocked this climber?
      if (me && me.id !== id) {
        const { count: bc } = await supabase
          .from("blocks")
          .select("blocker_id", { count: "exact", head: true })
          .eq("blocker_id", me.id)
          .eq("blocked_id", id);
        if (active) setBlocked((bc ?? 0) > 0);
      }

      if (me && me.id !== id) setStatus(await friendshipStatus(me.id, id));

      const canSeeSends = (data?.sends_public ?? false) || me?.id === id;
      if (canSeeSends) {
        const { data: sendRows } = await supabase
          .from("sends")
          .select("route_id, send_type, created_at")
          .eq("user_id", id)
          .neq("send_type", "attempt")
          .order("created_at", { ascending: false });
        const rows = sendRows ?? [];
        const routes = await fetchRoutesByIds(rows.map((s) => s.route_id));
        const byId = new Map(routes.map((r) => [r.id, r]));
        if (active) {
          setSends(routes);
          setFlashes(
            rows
              .filter((s) => s.send_type === "flash")
              .map((s) => byId.get(s.route_id))
              .filter((r): r is RouteWithStats => !!r),
          );
        }
      }

      const canSeeProjects = (data?.projects_public ?? false) || me?.id === id;
      if (canSeeProjects) {
        // RLS also enforces this, but we gate the query to avoid an empty round-trip.
        const { data: projRows } = await supabase
          .from("bookmarks")
          .select("route_id, created_at")
          .eq("user_id", id)
          .eq("kind", "project")
          .order("created_at", { ascending: false });
        const routes = await fetchRoutesByIds(
          (projRows ?? []).map((b) => b.route_id),
        );
        if (active) setProjects(routes);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, me]);

  // One button, four states: send request, cancel a sent request, accept an
  // incoming one, or remove an existing friend.
  async function onFriendAction() {
    if (!me || !id) return;
    // Removing an existing friend is a bigger deal — confirm it first.
    if (status === "friends") {
      setUnfriendOpen(true);
      return;
    }
    setBusy(true);
    if (status === "pending_out") {
      await removeFriend(me.id, id);
      setStatus("none");
    } else if (status === "pending_in") {
      await acceptFriendRequest(me.id, id);
      setStatus("friends");
    } else {
      await addFriendById(me.id, id);
      setStatus("pending_out");
    }
    setBusy(false);
  }

  async function confirmUnfriend() {
    if (!me || !id) return;
    setBusy(true);
    await removeFriend(me.id, id);
    setStatus("none");
    setBusy(false);
    setUnfriendOpen(false);
  }

  async function confirmBlock() {
    if (!me || !id) return;
    setBlockBusy(true);
    // Blocking severs any friendship/request between you.
    await removeFriend(me.id, id);
    await blockUser(me.id, id);
    setBlockBusy(false);
    setBlockOpen(false);
    setBlocked(true);
    setStatus("none");
    setSends([]);
    setProjects([]);
  }

  async function onUnblock() {
    if (!me || !id) return;
    setBlockBusy(true);
    await unblockUser(me.id, id);
    setBlockBusy(false);
    setBlocked(false);
  }

  if (loading) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
        <CenterSpinner />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col items-center justify-center gap-4 bg-bg px-8">
        <p className="text-faint">Climber not found.</p>
        <Button onClick={() => navigate("/")}>Back home</Button>
      </div>
    );
  }

  const canSeeSends = (person.sends_public || isMe) && !blocked;
  const canSeeProjects = (person.projects_public || isMe) && !blocked;

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="flex items-center gap-2 px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-full p-1 text-muted transition hover:text-chalk"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-chalk">Profile</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex flex-col items-center pt-2 text-center">
          <Avatar name={person.display_name} url={person.avatar_url} size={88} />
          <h2 className="mt-3 text-2xl font-extrabold text-chalk">
            {person.display_name}
          </h2>
          {person.username ? (
            <p className="mt-0.5 text-sm text-muted">@{person.username}</p>
          ) : null}
          {person.bio ? (
            <p className="mt-2 max-w-xs whitespace-pre-line text-sm text-chalk/90">
              {person.bio}
            </p>
          ) : null}

          {!isMe && me && !blocked ? (
            <Button
              variant={status === "none" || status === "pending_in" ? "primary" : "secondary"}
              className="mt-4 px-6"
              loading={busy}
              onClick={onFriendAction}
            >
              {status === "friends" ? (
                <>
                  <Check size={16} className="mr-1.5" /> Friends
                </>
              ) : status === "pending_out" ? (
                <>
                  <Clock size={16} className="mr-1.5" /> Requested
                </>
              ) : status === "pending_in" ? (
                <>
                  <Check size={16} className="mr-1.5" /> Accept request
                </>
              ) : (
                <>
                  <UserPlus size={16} className="mr-1.5" /> Add friend
                </>
              )}
            </Button>
          ) : null}
        </div>

        {blocked ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-surface p-6 text-center shadow-card">
            <Ban size={22} className="text-wide" />
            <p className="text-sm text-muted">
              You've blocked this climber. Their content is hidden from you.
            </p>
            <Button variant="secondary" loading={blockBusy} onClick={onUnblock}>
              Unblock
            </Button>
          </div>
        ) : (
          <>
            {/* Sends / Flashes / Projects — tap to switch the list below. */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              <TabTile
                label="Sends"
                icon={Check}
                value={sends.length}
                active={tab === "sends"}
                onClick={() => setTab("sends")}
              />
              <TabTile
                label="Flashes"
                icon={Zap}
                value={flashes.length}
                active={tab === "flashes"}
                onClick={() => setTab("flashes")}
              />
              <TabTile
                label="Projects"
                icon={Bookmark}
                value={canSeeProjects ? projects.length : null}
                active={tab === "projects"}
                onClick={() => setTab("projects")}
              />
            </div>

            {canSeeSends ? (
              <button
                onClick={() => navigate(`/u/${id}/passport`)}
                className="mt-4 flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
                  <Stamp size={18} style={{ color: "#ffc24b" }} /> View passport
                </span>
                <ChevronRight size={18} className="text-faint" />
              </button>
            ) : null}

            <div className="mt-6">
              {tab === "projects" ? (
                !canSeeProjects ? (
                  <PrivateNote text="This climber's projects are private." />
                ) : projects.length === 0 ? (
                  <EmptyNote text="No open projects." />
                ) : (
                  <RouteList routes={projects} system={system} />
                )
              ) : !canSeeSends ? (
                <PrivateNote text="This climber's logbook is private." />
              ) : tab === "flashes" ? (
                flashes.length === 0 ? (
                  <EmptyNote text="No flashes yet." />
                ) : (
                  <RouteList routes={flashes} system={system} />
                )
              ) : sends.length === 0 ? (
                <EmptyNote text="No sends logged yet." />
              ) : (
                <RouteList routes={sends} system={system} />
              )}
            </div>

            {!isMe && me ? (
              <button
                onClick={() => setBlockOpen(true)}
                className="mx-auto mt-10 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-faint transition hover:text-wide"
              >
                <Ban size={15} /> Block {person.display_name}
              </button>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        open={blockOpen}
        title={`Block ${person.display_name}?`}
        message="They'll be removed as a friend and their content will be hidden from you. You can unblock them anytime."
        confirmLabel="Block"
        variant="danger"
        onConfirm={confirmBlock}
        onCancel={() => setBlockOpen(false)}
      />

      <ConfirmDialog
        open={unfriendOpen}
        title={`Unfriend ${person.display_name}?`}
        message="You'll stop seeing each other's activity. You can always send another request later."
        confirmLabel="Unfriend"
        variant="danger"
        onConfirm={confirmUnfriend}
        onCancel={() => setUnfriendOpen(false)}
      />
    </div>
  );
}

function TabTile({
  label,
  icon: Icon,
  value,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Check;
  value: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-4 shadow-card transition ${
        active ? "bg-accent/10 ring-1 ring-accent" : "bg-surface"
      }`}
    >
      <Icon size={16} className={active ? "text-accent" : "text-faint"} />
      <span className={`text-2xl font-extrabold ${active ? "text-accent" : "text-chalk"}`}>
        {value === null ? "—" : value}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </button>
  );
}

function RouteList({
  routes,
  system,
}: {
  routes: RouteWithStats[];
  system: GradeSystem;
}) {
  return (
    <div className="flex flex-col gap-4">
      {routes.map((route, i) => (
        <RouteCard key={route.id} route={route} system={system} index={i} />
      ))}
    </div>
  );
}

function PrivateNote({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-faint">
      <Lock size={22} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-faint">{text}</p>;
}
