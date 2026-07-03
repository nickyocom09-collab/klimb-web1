import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, Lock, UserPlus } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoutesByIds, type RouteWithStats } from "../lib/routes";
import { addFriendById, areFriends, removeFriend } from "../lib/friends";
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
  const [friend, setFriend] = useState(false);
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

      if (me && me.id !== id) setFriend(await areFriends(me.id, id));

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

  async function toggleFriend() {
    if (!me || !id) return;
    setBusy(true);
    if (friend) {
      await removeFriend(me.id, id);
      setFriend(false);
    } else {
      await addFriendById(me.id, id);
      setFriend(true);
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
              variant={friend ? "secondary" : "primary"}
              className="mt-4 px-6"
              loading={busy}
              onClick={toggleFriend}
            >
              {friend ? (
                <>
                  <Check size={16} className="mr-1.5" /> Friends
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
