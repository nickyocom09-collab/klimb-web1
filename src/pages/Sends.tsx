import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Bookmark,
  Check,
  ChevronRight,
  Clapperboard,
  Flag,
  Plus,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  computeLogStats,
  DAY_MS,
  fetchLogbook,
  type LoggedItem,
  type ProjectItem,
} from "../lib/logstats";
import {
  fetchRecaps,
  markRecapSeen,
  recapCountdownLabel,
  type RecapRow,
} from "../lib/recaps";
import { formatGradeStyled } from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { fetchNotifications } from "../lib/notifications";
import { AppHeader } from "../components/Layout";
import { WeeklyRecap } from "../components/WeeklyRecap";
import { Button, CenterSpinner } from "../components/ui";
import type { RouteWithStats } from "../lib/routes";

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

// The Logbook IS the home tab — the app's front door and its soul. Every
// number here is computed from the user's own history, so it's fully alive
// with zero other users. Sends survive route archival; history is permanent.
export function Sends() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";
  const [logged, setLogged] = useState<LoggedItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [latestRecap, setLatestRecap] = useState<RecapRow | null>(null);
  const [story, setStory] = useState<RecapRow | null>(null);
  const [unread, setUnread] = useState(0);
  const [gymName, setGymName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"logged" | "topped" | "projecting">(
    "logged",
  );
  // Little celebration when a topped climb graduates to a clean send.
  const [celebrate, setCelebrate] = useState(false);

  // The home logbook is scoped to the gym you're currently at — your home
  // gym, or a gym you're visiting. Your *complete* logbook (every gym) lives
  // on the Profile tab. Switching gyms "resets" this view to that gym.
  const activeGymId = profile?.visiting_gym_id ?? profile?.home_gym_id ?? null;
  const isVisiting = !!profile?.visiting_gym_id;
  const scopedLogged = useMemo(
    () =>
      activeGymId
        ? logged.filter((l) => l.route.gym_id === activeGymId)
        : logged,
    [logged, activeGymId],
  );
  const scopedProjects = useMemo(
    () =>
      activeGymId
        ? projects.filter((p) => p.route.gym_id === activeGymId)
        : projects,
    [projects, activeGymId],
  );

  // Topped climbs (reached the top, but with falls) live apart from clean
  // sends — they're a to-do, not a trophy, until you go back for the send.
  const cleanSends = useMemo(
    () => scopedLogged.filter((l) => l.sendType !== "topped"),
    [scopedLogged],
  );
  const toppedItems = useMemo(
    () => scopedLogged.filter((l) => l.sendType === "topped"),
    [scopedLogged],
  );

  // Upgrade a topped climb to a clean send — the "I sent this" button.
  async function upgradeToSend(routeId: string) {
    if (!profile) return;
    setCelebrate(true);
    window.setTimeout(() => setCelebrate(false), 1600);
    setLogged((prev) =>
      prev.map((l) =>
        l.route.id === routeId ? { ...l, sendType: "send" } : l,
      ),
    );
    await supabase
      .from("sends")
      .update({ send_type: "send" })
      .eq("user_id", profile.id)
      .eq("route_id", routeId);
  }

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    (async () => {
      const [book, recs] = await Promise.all([
        fetchLogbook(profile.id),
        fetchRecaps(profile.id),
      ]);
      const gymForHeader = profile.visiting_gym_id ?? profile.home_gym_id;
      if (gymForHeader) {
        const { data: gym } = await supabase
          .from("gyms")
          .select("name")
          .eq("id", gymForHeader)
          .maybeSingle();
        if (active) setGymName(gym?.name ?? null);
      }
      if (!active) return;
      setLogged(book.logged);
      setProjects(book.projects);
      setLatestRecap(recs.latestWeekly ?? recs.latestMonthly);
      setLoading(false);
    })();
    // Unread notification badge (home carries the bell now).
    fetchNotifications(
      profile.id,
      profile.notifications_seen_at,
      profile.notifications_cleared_at,
    ).then((list) => {
      if (active) setUnread(list.filter((n) => n.unread).length);
    });
    return () => {
      active = false;
    };
  }, [profile]);

  const stats = useMemo(
    () => computeLogStats(scopedLogged, system),
    [scopedLogged, system],
  );

  const groups = useMemo(() => {
    const out: { label: string; items: LoggedItem[] }[] = [];
    for (const item of cleanSends) {
      const label = groupLabel(item.date);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [cleanSends]);

  function openStory(r: RecapRow) {
    setStory(r);
    if (!r.seen_at) {
      markRecapSeen(r.id);
      setLatestRecap((prev) =>
        prev && prev.id === r.id
          ? { ...prev, seen_at: new Date().toISOString() }
          : prev,
      );
    }
  }

  const delta = stats.thisWeek - stats.lastWeek;

  return (
    <div>
      <AppHeader
        title={
          view === "logged" ? "Sends" : view === "topped" ? "Topped" : "Projects"
        }
        subtitle={
          gymName
            ? `Climbing out of ${gymName}${isVisiting ? " (visiting)" : ""}`
            : "Your climbing history"
        }
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

      {loading ? (
        <CenterSpinner />
      ) : scopedLogged.length === 0 && scopedProjects.length === 0 ? (
        /* First-run: a warm nudge straight to the first log. */
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10">
            <TrendingUp size={36} className="text-accent" />
          </span>
          <h2 className="text-xl font-extrabold text-chalk">
            Your logbook starts here
          </h2>
          <p className="max-w-xs text-sm text-muted">
            Log your first climb and this page fills with your history, grade
            pyramid, streaks, and a weekly recap every Sunday.
          </p>
          <Button onClick={() => navigate("/log")}>
            <Plus size={18} className="mr-2" /> Log my first climb
          </Button>
        </div>
      ) : (
        <>
          {/* ---- Recap card: fresh one is loud, otherwise a quiet teaser --- */}
          <div className="px-5 pt-1">
            {latestRecap && !latestRecap.seen_at ? (
              <button
                onClick={() => openStory(latestRecap)}
                className="relative w-full overflow-hidden rounded-3xl bg-accent/10 p-5 text-left shadow-card ring-1 ring-accent/40 transition active:scale-[0.99]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/20 blur-2xl"
                />
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent">
                  <Clapperboard size={13} /> Ready to watch
                </p>
                <p className="mt-1 text-lg font-extrabold text-chalk">
                  Your {latestRecap.period === "weekly" ? "week" : "month"} in
                  climbing is in 🎬
                </p>
              </button>
            ) : (
              <p className="ml-1 flex items-center gap-1.5 text-xs text-faint">
                <Sparkles size={12} className="text-accent" /> Next weekly recap
                in {recapCountdownLabel()}
              </p>
            )}
          </div>

          {/* ---- Hero week stats ---- */}
          <div className="flex flex-col gap-3 px-5 pt-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat n={String(cleanSends.length)} label="Sends" />
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

            {scopedLogged.length > 0 ? (
              <button
                onClick={() => navigate("/stats")}
                className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left shadow-card transition active:scale-[0.99]"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
                  <TrendingUp size={16} className="text-accent" /> Your pyramid,
                  streaks &amp; records
                </span>
                <ChevronRight size={16} className="text-faint" />
              </button>
            ) : null}
          </div>

          {/* View toggle */}
          <div className="px-5 py-4">
            <div className="flex gap-1 rounded-full bg-surface-2 p-1">
              {(["logged", "topped", "projecting"] as const).map((v) => (
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
                    ? "Sends"
                    : v === "topped"
                      ? "Topped"
                      : "Projects"}
                </button>
              ))}
            </div>
          </div>

          {view === "logged" ? (
            cleanSends.length === 0 ? (
              <Empty text="No sends at this gym yet. Tap Log to record your first climb here." />
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
                            ) : item.sendType === "attempt" ? (
                              <Badge tone="muted">
                                <RotateCcw size={12} /> Attempt
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
          ) : view === "topped" ? (
            toppedItems.length === 0 ? (
              <Empty text="No topped climbs. When you reach the top with falls, it lands here — go back for the clean send." />
            ) : (
              <ul className="flex flex-col gap-2 px-5 pb-6">
                {toppedItems.map((item, i) => (
                  <ToppedRow
                    key={`${item.route.id}-${item.date}`}
                    route={item.route}
                    system={system}
                    index={i}
                    sub={fmt(item.date)}
                    note={item.note}
                    onSent={() => upgradeToSend(item.route.id)}
                  />
                ))}
              </ul>
            )
          ) : scopedProjects.length === 0 ? (
            <Empty text="Nothing on the project board here. Log a climb as 'Project' to add one." />
          ) : (
            <ul className="flex flex-col gap-2 px-5 pb-6">
              {scopedProjects.map((p, i) => (
                <RowLink
                  key={p.route.id}
                  route={p.route}
                  system={system}
                  index={i}
                  to={`/project/${p.route.id}`}
                  badge={
                    <Badge tone="muted">
                      <Bookmark size={12} /> Projecting
                    </Badge>
                  }
                  sub={daysOpen(p.since)}
                  note={p.notePeek}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {story ? (
        <WeeklyRecap recap={story} system={system} onClose={() => setStory(null)} />
      ) : null}

      {/* "I sent this" celebration — quick, satisfying, then it's gone. */}
      {celebrate ? (
        <div className="fixed inset-0 z-40 mx-auto flex max-w-app animate-fade-in flex-col items-center justify-center gap-3 bg-bg/90 backdrop-blur-sm">
          <span className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-accent/25 animate-pulse-ring" />
            <span
              className="absolute inset-0 rounded-full bg-accent/20"
              style={{ animation: "klimb-spark-ring 0.85s ease-out forwards" }}
            />
            <span className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-accent text-bg shadow-glow">
              <Trophy size={38} strokeWidth={2.5} />
            </span>
          </span>
          <p className="animate-fade-up text-3xl font-extrabold text-chalk [animation-delay:120ms]">
            Sent it!
          </p>
          <p className="animate-fade-up text-sm text-muted [animation-delay:220ms]">
            Clean send — off the projects, into the book.
          </p>
        </div>
      ) : null}
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
      <p className="text-2xl font-extrabold tabular-nums text-chalk">{n}</p>
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

/** A topped climb: the info opens the route; the button upgrades it to a send. */
function ToppedRow({
  route,
  system,
  index,
  sub,
  note,
  onSent,
}: {
  route: RouteWithStats;
  system: "american" | "european";
  index: number;
  sub: string;
  note?: string | null;
  onSent: () => void;
}) {
  const grade = route.gym_grade;
  return (
    <li style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}>
      <div className="animate-fade-up rounded-2xl bg-surface p-3 shadow-card">
        <Link
          to={`/route/${route.id}`}
          className="flex items-center gap-3 transition active:scale-[0.99]"
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
              <Badge tone="muted">
                <Flag size={12} /> Topped
              </Badge>
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
        <button
          onClick={onSent}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-bg transition active:scale-[0.99]"
        >
          <Trophy size={15} /> I sent this
        </button>
      </div>
    </li>
  );
}

function RowLink({
  route,
  system,
  index,
  badge,
  sub,
  note,
  to,
}: {
  route: RouteWithStats;
  system: "american" | "european";
  index: number;
  badge: React.ReactNode;
  sub: string;
  note?: string | null;
  /** Override destination (projects open their journal, not the route). */
  to?: string;
}) {
  const grade = route.gym_grade;
  return (
    <li style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}>
      <Link
        to={to ?? `/route/${route.id}`}
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
