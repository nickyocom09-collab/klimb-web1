import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Check, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoutesByIds, type RouteWithStats } from "../lib/routes";
import { fetchBookmarkedRouteIds } from "../lib/bookmarks";
import { communityGrade, formatGradeStyled } from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { AppHeader } from "../components/Layout";
import { CenterSpinner } from "../components/ui";
import type { SendType } from "../lib/database.types";

type LoggedItem = {
  route: RouteWithStats;
  sendType: SendType;
  note: string | null;
  date: string;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Sends() {
  const { profile } = useAuth();
  const system = profile?.grade_system ?? "american";
  const [logged, setLogged] = useState<LoggedItem[]>([]);
  const [projects, setProjects] = useState<RouteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"logged" | "projecting">("logged");

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    (async () => {
      const [{ data: sends }, projectIds] = await Promise.all([
        supabase
          .from("sends")
          .select("route_id, send_type, note, created_at")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false }),
        fetchBookmarkedRouteIds(profile.id, "project"),
      ]);

      const sendRows = sends ?? [];
      const routeIds = [
        ...new Set([...sendRows.map((s) => s.route_id), ...projectIds]),
      ];
      const routes = await fetchRoutesByIds(routeIds);
      const byId = new Map(routes.map((r) => [r.id, r]));

      if (!active) return;
      setLogged(
        sendRows
          .filter((s) => byId.has(s.route_id))
          .map((s) => ({
            route: byId.get(s.route_id)!,
            sendType: (s.send_type ?? "send") as SendType,
            note: s.note,
            date: s.created_at,
          })),
      );
      // Projects you haven't logged a send on yet = "still projecting".
      const sentIds = new Set(sendRows.map((s) => s.route_id));
      setProjects(
        projectIds
          .filter((rid) => byId.has(rid) && !sentIds.has(rid))
          .map((rid) => byId.get(rid)!),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  const stats = useMemo(() => {
    const flashes = logged.filter((l) => l.sendType === "flash").length;
    return { sends: logged.length, flashes, projects: projects.length };
  }, [logged, projects]);

  return (
    <div>
      <AppHeader title="Your logbook" subtitle="Everything you've climbed" />

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 px-5 pt-1">
        <Stat n={stats.sends} label="Logged" />
        <Stat n={stats.flashes} label="Flashes" />
        <Stat n={stats.projects} label="Projecting" />
      </div>

      {/* View toggle */}
      <div className="px-5 py-4">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(["logged", "projecting"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold capitalize transition ${
                view === v ? "bg-accent text-bg" : "text-muted hover:text-chalk"
              }`}
            >
              {v === "logged" ? "Logged" : "Projecting"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <CenterSpinner />
      ) : view === "logged" ? (
        logged.length === 0 ? (
          <Empty text="No logs yet. Tap Log to record your first climb." />
        ) : (
          <ul className="flex flex-col gap-2 px-5 pb-6">
            {logged.map((item, i) => (
              <RowLink
                key={`${item.route.id}-${item.date}`}
                route={item.route}
                system={system}
                index={i}
                badge={
                  item.sendType === "flash" ? (
                    <Badge tone="accent">
                      <Zap size={12} /> Flash
                    </Badge>
                  ) : (
                    <Badge tone="muted">
                      <Check size={12} /> Send
                    </Badge>
                  )
                }
                sub={fmt(item.date)}
                note={item.note}
              />
            ))}
          </ul>
        )
      ) : projects.length === 0 ? (
        <Empty text="Nothing on the project board. Log a climb as 'Project' to add one." />
      ) : (
        <ul className="flex flex-col gap-2 px-5 pb-6">
          {projects.map((route, i) => (
            <RowLink
              key={route.id}
              route={route}
              system={system}
              index={i}
              badge={
                <Badge tone="muted">
                  <Bookmark size={12} /> Projecting
                </Badge>
              }
              sub="Still working on it"
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-3 text-center shadow-card">
      <p className="text-2xl font-extrabold text-chalk">{n}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "accent" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        tone === "accent"
          ? "bg-accent/15 text-accent"
          : "bg-surface-2 text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-8 py-16 text-center text-faint">{text}</p>;
}

function RowLink({
  route,
  system,
  index,
  badge,
  sub,
  note,
}: {
  route: RouteWithStats;
  system: "american" | "european";
  index: number;
  badge: React.ReactNode;
  sub: string;
  note?: string | null;
}) {
  const grade = communityGrade(route.gradeValues);
  return (
    <li style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}>
      <Link
        to={`/route/${route.id}`}
        className="flex animate-fade-up items-center gap-3 rounded-2xl bg-surface p-3 shadow-card transition active:scale-[0.99]"
      >
        <img
          src={route.photo_url}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold text-chalk">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-white/10"
              style={{ backgroundColor: holdHex(route.hold_color) }}
            />
            <span className="truncate">
              {route.hold_color} · {route.wall_section}
            </span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            {badge}
            <span className="truncate text-xs text-muted">{sub}</span>
          </div>
          {note ? (
            <p className="mt-1 truncate text-xs italic text-faint">"{note}"</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-extrabold leading-none text-accent">
            {formatGradeStyled(grade, route.climbing_type, system, route.gradingStyle)}
          </p>
          <p className="mt-0.5 text-[10px] text-faint">
            {climbTypeLabel(route.climbing_type)}
          </p>
        </div>
      </Link>
    </li>
  );
}
