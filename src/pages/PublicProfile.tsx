import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Clock, Lock, Stamp, UserPlus } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoutesByIds, type RouteWithStats } from "../lib/routes";
import {
  acceptFriendRequest,
  addFriendById,
  friendshipStatus,
  removeFriend,
  type FriendStatus,
} from "../lib/friends";
import { Avatar } from "../components/Avatar";
import { RouteCard } from "../components/RouteCard";
import { Button, CenterSpinner } from "../components/ui";

type PubProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  sends_public: boolean;
};

export function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { profile: me } = useAuth();
  const navigate = useNavigate();
  const system = me?.grade_system ?? "american";

  const [person, setPerson] = useState<PubProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendCount, setSendCount] = useState(0);
  const [gradeCount, setGradeCount] = useState(0);
  const [sends, setSends] = useState<RouteWithStats[]>([]);
  const [status, setStatus] = useState<FriendStatus>("none");
  const [busy, setBusy] = useState(false);

  const isMe = !!me && me.id === id;

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, bio, sends_public")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      setPerson(data as PubProfile | null);

      const [{ count: sc }, { count: gc }] = await Promise.all([
        supabase
          .from("sends")
          .select("id", { count: "exact", head: true })
          .eq("user_id", id),
        supabase
          .from("grades")
          .select("id", { count: "exact", head: true })
          .eq("user_id", id),
      ]);
      if (!active) return;
      setSendCount(sc ?? 0);
      setGradeCount(gc ?? 0);

      if (me && me.id !== id) setStatus(await friendshipStatus(me.id, id));

      const canSee = (data?.sends_public ?? false) || me?.id === id;
      if (canSee) {
        const { data: sendRows } = await supabase
          .from("sends")
          .select("route_id, created_at")
          .eq("user_id", id)
          .order("created_at", { ascending: false });
        const routes = await fetchRoutesByIds(
          (sendRows ?? []).map((s) => s.route_id),
        );
        if (active) setSends(routes);
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
    setBusy(true);
    if (status === "friends" || status === "pending_out") {
      // Remove friend, or cancel the request I sent.
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

  const canSee = person.sends_public || isMe;

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

          {!isMe && me ? (
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

        <div className="mt-6 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface px-3 py-4 text-center shadow-card">
            <p className="text-2xl font-extrabold text-accent">{sendCount}</p>
            <p className="text-xs text-muted">Sends</p>
          </div>
          <div className="rounded-2xl bg-surface px-3 py-4 text-center shadow-card">
            <p className="text-2xl font-extrabold text-accent">{gradeCount}</p>
            <p className="text-xs text-muted">Grades</p>
          </div>
        </div>

        {canSee ? (
          <button
            onClick={() => navigate(`/u/${id}/passport`)}
            className="mt-6 flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
              <Stamp size={18} style={{ color: "#ffc24b" }} /> View passport
            </span>
            <ChevronRight size={18} className="text-faint" />
          </button>
        ) : null}

        <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-faint">
          Logbook
        </h3>
        {!canSee ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-faint">
            <Lock size={22} />
            <p className="text-sm">This climber's logbook is private.</p>
          </div>
        ) : sends.length === 0 ? (
          <p className="py-10 text-center text-sm text-faint">
            No sends logged yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {sends.map((route, i) => (
              <RouteCard
                key={route.id}
                route={route}
                system={system}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
