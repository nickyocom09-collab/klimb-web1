import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Check, TrendingUp, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoutesByIds, type RouteWithStats } from "../lib/routes";
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
  /** Best-known ordinal for this climb: your grade > community > gym. */
  ordinal: number | null;
};

type ProjectItem = {
  route: RouteWithStats;
  since: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Today" / "This week" / "June 2026" — playlist-style session groups. */
function groupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  if (now.getTime() - d.getTime() < 7 * DAY_MS) return "This week";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function daysOpen(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "Opened today";
  return `Open ${days} day${days === 1 ? "" : "s"}`;
}

// The Logbook: the heart of the single-player app. Everything on this page is
// computed from the user's own history, so it's fully useful with zero other
// users. Sends survive route archival — history never disappears.
export function Sends() {
  const { profile } = useAuth();
  const system = profile?.grade_system ?? "american";
  const [logged, setLogged] = useState<LoggedItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [gymName, setGymName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"logged" | "projecting">("logged");

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    (async () => {
      const [{ data: sends }, { data: bms }, { data: myGradeRows }] =
        await Promise.all([
          supabase
            .from("sends")
            .select("route_id, send_type, note, created_at")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("bookmarks")
            .select("route_id, created_at")
            .eq("user_id", profile.id)
            .eq("kind", "project")
            .order("created_at", { ascending: false }),
          supabase
            .from("grades")
            .select("route_id, grade")
            .eq("user_id", profile.id),
        ]);

      if (profile.home_gym_id) {
        const { data: gym } = await supabase
          .from("gyms")
          .select("name")
          .eq("id", profile.home_gym_id)
          .maybeSingle();
        if (active) setGymName(gym?.name ?? null);
      }

      const sendRows = sends ?? [];
      const bmRows = bms ?? [];
      const myGrades = new Map(
        (myGradeRows ?? []).map((g) => [g.route_id, g.grade]),
      );
      const routeIds = [
        ...new Set([
          ...sendRows.map((s) => s.route_id),
          ...bmRows.map((b) => b.route_id),
        ]),
      ];
      const routes = await fetchRoutesByIds(routeIds);
      const byId = new Map(routes.map((r) => [r.id, r]));

      if (!active) return;
      setLogged(
        sendRows
          .filter((s) => byId.has(s.route_id))
          .map((s) => {
            const route = byId.get(s.route_id)!;
            const ordinal =
              myGrades.get(s.route_id) ??
              communityGrade(route.gradeValues) ??
              route.gym_grade ??
              null;
            return {
              route,
              sendType: (s.send_type ?? "send") as SendType,
              note: s.note,
              date: s.created_at,
              ordinal,
            };
          }),
      );
      // Projects you haven't logged a send on yet = "still projecting".
      const sentIds = new Set(sendRows.map((s) => s.route_id));
      setProjects(
        bmRows
          .filter((b) => byId.has(b.route_id) && !sentIds.has(b.route_id))
          .map((b) => ({ route: byId.get(b.route_id)!, since: b.created_at })),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  const stats = useMemo(() => {
    const now = Date.now();
    const flashes = logged.filter((l) => l.sendType === "flash");
    const thisWeek = logged.filter(
      (l) => now - new Date(l.date).getTime() < 7 * DAY_MS,
    ).length;
    const lastWeek = logged.filter((l) => {
      const age = now - new Date(l.date).getTime();
      return age >= 7 * DAY_MS && age < 14 * DAY_MS;
    }).length;

    // Grade pyramid: sends bucketed by their display label, ordered easy→hard
    // (boulders first, then ropes), in the route's own grading style.
    const buckets = new Map<string, { count: number; sort: number }>();
    for (const l of logged) {
      if (l.ordinal === null) continue;
      const label = formatGradeStyled(
        l.ordinal,
        l.route.climbing_type,
        system,
        l.route.gradingStyle,
      );
      const sort =
        (l.route.climbing_type === "toprope" ? 100 : 0) + l.ordinal;
      const cur = buckets.get(label) ?? { count: 0, sort };
      cur.count += 1;
      buckets.set(label, cur);
    }
    const pyramid = [...buckets.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => a.sort - b.sort);

    // Hardest send / flash, per climbing type (V-scale and YDS ordinals
    // aren't comparable across types).
    const hardest = (items: LoggedItem[]) => {
      let boulder: LoggedItem | null = null;
      let toprope: LoggedItem | null = null;
      for (const l of items) {
        if (l.ordinal === null) continue;
        if (l.route.climbing_type === "boulder") {
          if (!boulder || l.ordinal > boulder.ordinal!) boulder = l;
        } else if (!toprope || l.ordinal > toprope.ordinal!) toprope = l;
      }
      return { boulder, toprope };
    };

    // Sends per week for the last 8 rolling weeks (oldest → newest).
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const hi = now - (7 - i) * 7 * DAY_MS + 7 * DAY_MS;
      const lo = hi - 7 * DAY_MS;
      return logged.filter((l) => {
        const t = new Date(l.date).getTime();
        return t >= lo && t < hi;
      }).length;
    });

    return {
      total: logged.length,
      flashes: flashes.length,
      thisWeek,
      lastWeek,
      pyramid,
      hardestSend: hardest(logged),
      hardestFlash: hardest(flashes),
      weeks,
    };
  }, [logged, system]);

  const groups = useMemo(() => {
    const out: { label: string; items: LoggedItem[] }[] = [];
    for (const item of logged) {
      const label = groupLabel(item.date);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [logged]);

  const fmtHardest = (h: { boulder: LoggedItem | null; toprope: LoggedItem | null }) => {
    const parts: string[] = [];
    if (h.boulder)
      parts.push(
        formatGradeStyled(
          h.boulder.ordinal,
          "boulder",
          system,
          h.boulder.route.gradingStyle,
        ),
      );
    if (h.toprope)
      parts.push(
        formatGradeStyled(
          h.toprope.ordinal,
          "toprope",
          system,
          h.toprope.route.gradingStyle,
        ),
      );
    return parts.length ? parts.join(" · ") : "—";
  };

  const weekMax = Math.max(...stats.weeks, 1);
  const delta = stats.thisWeek - stats.lastWeek;

  return (
    <div>
      <AppHeader
        title="Logbook"
        subtitle={gymName ? `Climbing out of ${gymName}` : "Everything you've climbed"}
      />

      {loading ? (
        <CenterSpinner />
      ) : (
        <>
          {/* ---- Progress dashboard (all from your own history) ---- */}
          <div className="flex flex-col gap-3 px-5 pt-1">
            <div className="grid grid-cols-3 gap-2">
              <Stat n={String(stats.total)} label="Sends" />
              <Stat n={String(stats.flashes)} label="Flashes" />
              <Stat
                n={String(stats.thisWeek)}
                label="This week"
                sub={
                  delta === 0
                    ? "same as last wk"
                    : `${delta > 0 ? "+" : ""}${delta} vs last wk`
                }
                subTone={delta > 0 ? "accent" : delta < 0 ? "wide" : "faint"}
              />
            </div>

            {logged.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-surface px-4 py-3 shadow-card">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Hardest send
                    </p>
                    <p className="mt-0.5 text-2xl font-extrabold leading-tight text-accent">
                      {fmtHardest(stats.hardestSend)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-surface px-4 py-3 shadow-card">
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      <Zap size={11} className="text-accent" /> Hardest flash
                    </p>
                    <p className="mt-0.5 text-2xl font-extrabold leading-tight text-chalk">
                      {fmtHardest(stats.hardestFlash)}
                    </p>
                  </div>
                </div>

                {/* Grade pyramid */}
                {stats.pyramid.length > 0 ? (
                  <div className="rounded-2xl bg-surface p-4 shadow-card">
                    <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-faint">
                      <TrendingUp size={14} className="text-accent" /> Grade
                      pyramid
                    </h2>
                    <div className="flex flex-col gap-1.5">
                      {stats.pyramid.map((b) => {
                        const max = Math.max(
                          ...stats.pyramid.map((x) => x.count),
                        );
                        return (
                          <div key={b.label} className="flex items-center gap-2">
                            <span className="w-14 shrink-0 text-right text-xs font-semibold text-muted">
                              {b.label}
                            </span>
                            <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-accent transition-all"
                                style={{
                                  width: `${(b.count / max) * 100}%`,
                                  minWidth: "0.5rem",
                                }}
                              />
                            </div>
                            <span className="w-5 shrink-0 text-xs text-faint">
                              {b.count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Weekly activity sparkline */}
                <div className="rounded-2xl bg-surface p-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
                      Last 8 weeks
                    </h2>
                    <span className="text-xs text-muted">
                      {stats.weeks.reduce((a, b) => a + b, 0)} climbs
                    </span>
                  </div>
                  <div className="mt-3 flex h-12 items-end gap-1.5">
                    {stats.weeks.map((n, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t-md ${
                          i === 7 ? "bg-accent" : "bg-surface-2"
                        }`}
                        style={{
                          height: `${Math.max((n / weekMax) * 100, n > 0 ? 18 : 6)}%`,
                        }}
                        title={`${n} climb${n === 1 ? "" : "s"}`}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* View toggle */}
          <div className="px-5 py-4">
            <div className="flex gap-1 rounded-full bg-surface-2 p-1">
              {(["logged", "projecting"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                    view === v
                      ? "bg-accent text-bg"
                      : "text-muted hover:text-chalk"
                  }`}
                >
                  {v === "logged"
                    ? "Logged"
                    : `Projecting${projects.length ? ` · ${projects.length}` : ""}`}
                </button>
              ))}
            </div>
          </div>

          {view === "logged" ? (
            logged.length === 0 ? (
              <Empty text="No logs yet. Tap Log to record your first climb — your history starts there." />
            ) : (
              <div className="flex flex-col gap-5 px-5 pb-6">
                {groups.map((g) => (
                  <section key={g.label}>
                    <h2 className="mb-2 ml-1 text-sm font-semibold uppercase tracking-wide text-faint">
                      {g.label}
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {g.items.map((item, i) => (
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
                  </section>
                ))}
              </div>
            )
          ) : projects.length === 0 ? (
            <Empty text="Nothing on the project board. Log a climb as 'Project' to add one." />
          ) : (
            <ul className="flex flex-col gap-2 px-5 pb-6">
              {projects.map((p, i) => (
                <RowLink
                  key={p.route.id}
                  route={p.route}
                  system={system}
                  index={i}
                  badge={
                    <Badge tone="muted">
                      <Bookmark size={12} /> Projecting
                    </Badge>
                  }
                  sub={daysOpen(p.since)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  n,
  label,
  sub,
  subTone = "faint",
}: {
  n: string;
  label: string;
  sub?: string;
  subTone?: "accent" | "wide" | "faint";
}) {
  const tone =
    subTone === "accent"
      ? "text-accent"
      : subTone === "wide"
        ? "text-wide"
        : "text-faint";
  return (
    <div className="rounded-2xl bg-surface px-3 py-3 text-center shadow-card">
      <p className="text-2xl font-extrabold text-chalk">{n}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      {sub ? <p className={`mt-0.5 text-[10px] ${tone}`}>{sub}</p> : null}
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
            {route.status === "archived" ? (
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-faint">
                Archived
              </span>
            ) : null}
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
