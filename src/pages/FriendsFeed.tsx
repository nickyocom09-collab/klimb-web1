import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bookmark, Check, ChevronLeft, Clock3, Flag, SlidersHorizontal, UsersRound, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchFriends, type FriendProfile } from "../lib/friends";
import { fetchRoutesByIds, type RouteWithStats } from "../lib/routes";
import type { SendType } from "../lib/database.types";
import { holdHex } from "../lib/constants";
import { routeLabel } from "../lib/routeLabel";
import { Avatar } from "../components/Avatar";
import { CenterSpinner } from "../components/ui";
import { RouteGradeStack } from "../components/RouteGradeStack";
import { ActivityReactions } from "../components/ActivityReactions";
import { normalizeStoredReaction, type ReactionCounts } from "../lib/reactions";
import { ProBadge } from "../components/ProBadge";
import { ZoomPhotoViewer } from "../components/ZoomPhotoViewer";

type ActivityKind = "send" | "project";

type FriendActivity = {
  id: string;
  sourceId: string;
  kind: ActivityKind;
  sendType?: SendType;
  createdAt: string;
  friend: FriendProfile;
  route: RouteWithStats;
  grade: number | null;
  reactions: ReactionCounts;
  myReaction: string | null;
};

function activityCopy(kind: ActivityKind, sendType?: SendType) {
  if (kind === "project") return { label: "Project", sentence: "started projecting", Icon: Bookmark };
  if (sendType === "flash") return { label: "Flash", sentence: "flashed", Icon: Zap };
  if (sendType === "topped") return { label: "Topped", sentence: "topped", Icon: Flag };
  return { label: "Send", sentence: "sent", Icon: Check };
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export function FriendsFeed() {
  const { profile } = useAuth();
  const profileId = profile?.id ?? null;
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const nextFriends = await fetchFriends(profileId);
        if (!active) return;
        setFriends(nextFriends);
        const friendById = new Map(nextFriends.map((friend) => [friend.id, friend]));
        const activityResult = nextFriends.length
          ? await supabase.rpc("get_friend_activity", { p_limit_per_friend: 8 })
          : { data: [], error: null };
        if (activityResult.error) throw activityResult.error;
        if (!active) return;

        const activityRows = activityResult.data ?? [];
        const routeIds = [...new Set(activityRows.map((item) => item.route_id))];
        const activityIds = activityRows.map((item) => item.activity_id);
        const [routes, gradesResult, reactionsResult] = await Promise.all([
          fetchRoutesByIds(routeIds),
          routeIds.length
            ? supabase.from("grades").select("user_id, route_id, grade").in("user_id", nextFriends.map((friend) => friend.id)).in("route_id", routeIds)
            : Promise.resolve({ data: [] as { user_id: string; route_id: string; grade: number }[], error: null }),
          activityIds.length
            ? supabase.from("activity_reactions").select("activity_kind, activity_id, reactor_id, reaction").in("activity_id", activityIds)
            : Promise.resolve({ data: [] as { activity_kind: ActivityKind; activity_id: string; reactor_id: string; reaction: string }[], error: null }),
        ]);
        if (gradesResult.error) throw gradesResult.error;
        if (reactionsResult.error) throw reactionsResult.error;
        if (!active) return;

        const routeById = new Map(routes.map((route) => [route.id, route]));
        const gradeByKey = new Map((gradesResult.data ?? []).map((row) => [`${row.user_id}:${row.route_id}`, row.grade]));
        const reactionsByActivity = new Map<string, { counts: ReactionCounts; mine: string | null }>();
        for (const row of reactionsResult.data ?? []) {
          const reaction = normalizeStoredReaction(row.reaction);
          const key = `${row.activity_kind}:${row.activity_id}`;
          const summary = reactionsByActivity.get(key) ?? { counts: {}, mine: null };
          summary.counts[reaction] = (summary.counts[reaction] ?? 0) + 1;
          if (row.reactor_id === profileId) summary.mine = reaction;
          reactionsByActivity.set(key, summary);
        }

        const feed = activityRows.flatMap((row): FriendActivity[] => {
          const kind = row.activity_kind;
          const friend = friendById.get(row.activity_owner_id);
          const route = routeById.get(row.route_id);
          const reactions = reactionsByActivity.get(`${kind}:${row.activity_id}`) ?? { counts: {}, mine: null };
          return friend && route
            ? [{
                id: `${kind}:${row.activity_id}`,
                sourceId: row.activity_id,
                kind,
                sendType: row.send_type ?? undefined,
                createdAt: row.created_at,
                friend,
                route,
                grade: gradeByKey.get(`${row.activity_owner_id}:${row.route_id}`) ?? null,
                reactions: reactions.counts,
                myReaction: reactions.mine,
              }]
            : [];
        });
        setActivities(feed);
      } catch {
        if (!active) return;
        setActivities([]);
        setLoadError("Your friends' Klimbs couldn't load. Check your connection and try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [profileId, reloadKey]);

  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => {
      const difference = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortOrder === "recent" ? difference : -difference;
    }),
    [activities, sortOrder],
  );

  async function react(activity: FriendActivity, nextReaction: string) {
    if (!profileId || reactingId === activity.id) return;
    const previousReaction = activity.myReaction;
    // Keep one durable reaction row per Klimb/person. Changing the emoji
    // updates that row (and preserves its original notification timestamp)
    // instead of deleting/recreating it and notifying the owner again.
    const unchanged = previousReaction === nextReaction;
    if (unchanged) return;
    setReactingId(activity.id);
    setActivities((current) => current.map((item) => {
      if (item.id !== activity.id) return item;
      const counts = { ...item.reactions };
      if (previousReaction) counts[previousReaction] = Math.max(0, (counts[previousReaction] ?? 0) - 1);
      counts[nextReaction] = (counts[nextReaction] ?? 0) + 1;
      return { ...item, reactions: counts, myReaction: nextReaction };
    }));

    const result = await supabase.from("activity_reactions").upsert({
      activity_kind: activity.kind,
      activity_id: activity.sourceId,
      route_id: activity.route.id,
      activity_owner_id: activity.friend.id,
      reactor_id: profileId,
      reaction: nextReaction,
    }, { onConflict: "activity_kind,activity_id,reactor_id" });
    if (result.error) {
      setActivities((current) => current.map((item) => item.id === activity.id
        ? { ...item, reactions: activity.reactions, myReaction: previousReaction }
        : item));
    }
    setReactingId(null);
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="flex items-center gap-3 px-5 pb-5 pt-5">
        <button onClick={() => navigate(-1)} aria-label="Back" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted transition active:scale-95">
          <ChevronLeft size={28} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Your circle</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-chalk">Friends</h1>
        </div>
        <Link to="/friends/manage" aria-label={`Manage ${friends.length} friends`} className="flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-bold text-chalk transition active:scale-[0.97]">
          <SlidersHorizontal size={17} className="text-accent" /> Manage
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? (
          <CenterSpinner />
        ) : loadError ? (
          <div className="mx-auto flex h-full max-w-xs flex-col items-center justify-center px-5 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface text-faint"><UsersRound size={28} /></span>
            <h2 className="mt-5 text-lg font-bold text-chalk">Couldn&apos;t load your circle</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{loadError}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-5 rounded-2xl bg-accent px-5 py-3 text-sm font-extrabold text-bg transition active:scale-[0.97]">
              Try again
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div className="mx-auto flex max-w-xs flex-col items-center py-24 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface text-faint"><UsersRound size={28} /></span>
            <h2 className="mt-5 text-lg font-bold text-chalk">Your circle is quiet</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Friends' posted sends and projects will appear here.</p>
            <Link to="/friends/manage" className="mt-5 text-sm font-bold text-accent">Find friends</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="sticky top-0 z-10 -mx-1 flex justify-end bg-bg/90 px-1 pb-2 backdrop-blur-xl">
              <div className="flex rounded-full border border-border bg-surface p-1" aria-label="Sort friend activity">
                {(["recent", "oldest"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSortOrder(option)}
                    aria-pressed={sortOrder === option}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${sortOrder === option ? "bg-accent text-bg" : "text-muted"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            {sortedActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                system={profile?.grade_system ?? "american"}
                busy={reactingId === activity.id}
                onReact={(reaction) => void react(activity, reaction)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityCard({ activity, system, busy, onReact }: {
  activity: FriendActivity;
  system: "american" | "european";
  busy: boolean;
  onReact: (reaction: string) => void;
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const { label, sentence, Icon } = activityCopy(activity.kind, activity.sendType);
  const labelForRoute = routeLabel(activity.route);
  const activityLine = activity.route.name ? `${sentence} ${labelForRoute}` : `${sentence} a ${labelForRoute.toLowerCase()} route`;
  return (
    <article className="overflow-hidden rounded-[1.65rem] bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Link to={`/u/${activity.friend.id}`} state={{ person: activity.friend }} className="shrink-0 transition active:scale-95">
          <Avatar name={activity.friend.display_name} url={activity.friend.avatar_url} size={42} />
        </Link>
        <Link to={`/u/${activity.friend.id}`} state={{ person: activity.friend }} className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-extrabold text-chalk">
            <span className="truncate">{activity.friend.display_name}</span>
            {activity.friend.is_pro ? <ProBadge compact /> : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">{activityLine}</p>
        </Link>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-faint"><Clock3 size={13} /> {relativeTime(activity.createdAt)}</span>
      </div>
      <button type="button" onClick={() => setPhotoOpen(true)} className="group relative block aspect-[16/10] w-full overflow-hidden bg-surface-2 text-left">
        <img src={activity.route.photo_url} alt={labelForRoute} loading="lazy" draggable={false} className="h-full w-full select-none object-cover transition duration-500 group-active:scale-[1.02]" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-bg/78 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-chalk backdrop-blur-xl">
          <Icon size={14} className="text-accent" /> {label}
        </span>
        <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-bg/85 px-3 py-1.5 text-sm font-bold text-chalk backdrop-blur-xl">
          <span className={`h-2.5 w-2.5 rounded-full ${activity.route.hold_color === "White" ? "ring-1 ring-black/20" : ""}`} style={{ backgroundColor: holdHex(activity.route.hold_color) }} />
          {labelForRoute}
        </span>
      </button>
      <Link to={`/route/${activity.route.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 transition active:bg-surface-2/70">
        <div className="min-w-0">
          <p className="text-sm font-bold text-chalk">View route</p>
          <p className="mt-0.5 truncate text-xs text-muted">{activity.route.wall_section || "At their gym"}</p>
        </div>
        <RouteGradeStack route={activity.route} system={system} userGrade={activity.grade} perspective="They" />
      </Link>
      <ActivityReactions mine={activity.myReaction} busy={busy} onReact={onReact} />
      {photoOpen ? (
        <ZoomPhotoViewer src={activity.route.photo_url} alt={labelForRoute} onClose={() => setPhotoOpen(false)} />
      ) : null}
    </article>
  );
}
