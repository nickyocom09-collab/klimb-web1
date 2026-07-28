import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Check,
  ChevronLeft,
  Clock3,
  Flag,
  SlidersHorizontal,
  UsersRound,
  Zap,
} from "lucide-react";
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

type ActivityKind = "send" | "project";

type FriendActivity = {
  id: string;
  kind: ActivityKind;
  sendType?: SendType;
  createdAt: string;
  friend: FriendProfile;
  route: RouteWithStats;
  grade: number | null;
};

function activityCopy(kind: ActivityKind, sendType?: SendType) {
  if (kind === "project") {
    return { label: "Project", sentence: "started a project", Icon: Bookmark };
  }
  if (sendType === "flash") {
    return { label: "Flash", sentence: "flashed", Icon: Zap };
  }
  if (sendType === "topped") {
    return { label: "Topped", sentence: "topped", Icon: Flag };
  }
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
  const navigate = useNavigate();
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ActivityKind>("all");

  useEffect(() => {
    if (!profile) return;
    let active = true;

    (async () => {
      setLoading(true);
      const friends = await fetchFriends(profile.id);
      const friendById = new Map(friends.map((friend) => [friend.id, friend]));
      const sendIds = friends.filter((friend) => friend.sends_public).map((friend) => friend.id);
      const projectIds = friends.filter((friend) => friend.projects_public).map((friend) => friend.id);

      const [sendResult, projectResult] = await Promise.all([
        sendIds.length
          ? supabase
              .from("sends")
              .select("id, user_id, route_id, send_type, created_at")
              .in("user_id", sendIds)
              .neq("send_type", "attempt")
              .order("created_at", { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [] as { id: string; user_id: string; route_id: string; send_type: SendType; created_at: string }[] }),
        projectIds.length
          ? supabase
              .from("bookmarks")
              .select("id, user_id, route_id, created_at")
              .in("user_id", projectIds)
              .eq("kind", "project")
              .order("created_at", { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [] as { id: string; user_id: string; route_id: string; created_at: string }[] }),
      ]);

      const sends = sendResult.data ?? [];
      const projects = projectResult.data ?? [];
      const routeIds = [...new Set([...sends, ...projects].map((item) => item.route_id))];
      const [routes, gradesResult] = await Promise.all([
        fetchRoutesByIds(routeIds),
        routeIds.length
          ? supabase
              .from("grades")
              .select("user_id, route_id, grade")
              .in("user_id", friends.map((friend) => friend.id))
              .in("route_id", routeIds)
          : Promise.resolve({ data: [] as { user_id: string; route_id: string; grade: number }[] }),
      ]);
      if (!active) return;

      const routeById = new Map(routes.map((route) => [route.id, route]));
      const gradeByKey = new Map((gradesResult.data ?? []).map((row) => [`${row.user_id}:${row.route_id}`, row.grade]));
      const feed: FriendActivity[] = [
        ...sends.flatMap((send) => {
          const friend = friendById.get(send.user_id);
          const route = routeById.get(send.route_id);
          return friend && route
            ? [{ id: `send:${send.id}`, kind: "send" as const, sendType: send.send_type, createdAt: send.created_at, friend, route, grade: gradeByKey.get(`${send.user_id}:${send.route_id}`) ?? null }]
            : [];
        }),
        ...projects.flatMap((project) => {
          const friend = friendById.get(project.user_id);
          const route = routeById.get(project.route_id);
          return friend && route
            ? [{ id: `project:${project.id}`, kind: "project" as const, createdAt: project.created_at, friend, route, grade: gradeByKey.get(`${project.user_id}:${project.route_id}`) ?? null }]
            : [];
        }),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActivities(feed);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [profile?.id]);

  const visibleActivities = useMemo(
    () => activities.filter((activity) => filter === "all" || activity.kind === filter),
    [activities, filter],
  );

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="flex items-center gap-3 px-5 pb-4 pt-5">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted transition active:scale-95"
        >
          <ChevronLeft size={28} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Your circle</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-chalk">Friends</h1>
        </div>
        <Link
          to="/friends/manage"
          className="flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-bold text-chalk transition active:scale-[0.97]"
        >
          <SlidersHorizontal size={17} className="text-accent" /> Manage
        </Link>
      </header>

      <div className="flex gap-2 overflow-x-auto px-5 pb-4 [scrollbar-width:none]">
        {(["all", "send", "project"] as const).map((option) => {
          const label = option === "all" ? "Everything" : option === "send" ? "Sends" : "Projects";
          const selected = filter === option;
          return (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${selected ? "bg-accent text-bg" : "bg-surface text-muted"}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        {loading ? (
          <CenterSpinner />
        ) : visibleActivities.length === 0 ? (
          <div className="mx-auto flex max-w-xs flex-col items-center py-24 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface text-faint"><UsersRound size={28} /></span>
            <h2 className="mt-5 text-lg font-bold text-chalk">Nothing here yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted">When friends log a send or start a project, it will show up here.</p>
            <Link to="/friends/manage" className="mt-5 text-sm font-bold text-accent">Manage friends</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} system={profile?.grade_system ?? "american"} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityCard({ activity, system }: { activity: FriendActivity; system: "american" | "european" }) {
  const { label, sentence, Icon } = activityCopy(activity.kind, activity.sendType);
  const labelForRoute = routeLabel(activity.route);
  const activityLine = activity.route.name
    ? `${sentence} ${labelForRoute}`
    : `${sentence} a ${labelForRoute.toLowerCase()} route`;
  return (
    <article className="overflow-hidden rounded-[1.6rem] bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Link to={`/u/${activity.friend.id}`} className="shrink-0">
          <Avatar name={activity.friend.display_name} url={activity.friend.avatar_url} size={40} />
        </Link>
        <Link to={`/u/${activity.friend.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-chalk">{activity.friend.display_name}</p>
          <p className="truncate text-xs text-muted">{activityLine}</p>
        </Link>
        <span className="flex items-center gap-1 text-xs font-medium text-faint"><Clock3 size={13} /> {relativeTime(activity.createdAt)}</span>
      </div>
      <Link to={`/route/${activity.route.id}`} className="group relative block aspect-[16/10] overflow-hidden bg-surface-2">
        <img src={activity.route.photo_url} alt={labelForRoute} loading="lazy" className="h-full w-full object-cover transition duration-500 group-active:scale-[1.02]" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-bg/85 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-chalk backdrop-blur">
          <Icon size={14} className="text-accent" /> {label}
        </span>
        <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-bg/85 px-3 py-1.5 text-sm font-bold text-chalk backdrop-blur">
          <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/15" style={{ backgroundColor: holdHex(activity.route.hold_color) }} />
          {labelForRoute}
        </span>
      </Link>
      <Link to={`/route/${activity.route.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 transition active:bg-surface-2/70">
        <div className="min-w-0">
          <p className="text-sm font-bold text-chalk">View route</p>
          <p className="mt-0.5 text-xs text-muted">{activity.route.wall_section || "At their gym"}</p>
        </div>
        <RouteGradeStack route={activity.route} system={system} userGrade={activity.grade} perspective="They" />
      </Link>
    </article>
  );
}
