import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRightLeft,
  Bell,
  Bookmark,
  Check,
  ChevronRight,
  Clapperboard,
  Plus,
  RotateCcw,
  Sparkles,
  TrendingUp,
  X,
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
  findApprovedGymForLabel,
  offGridToLoggedItems,
  type PersonalLogRow,
} from "../lib/personalLogs";
import { OffGridSection } from "../components/OffGridSection";
import { TransferOffGridSheet } from "../components/TransferOffGridSheet";
import {
  fetchRecaps,
  markRecapSeen,
  recapCountdownLabel,
  type RecapRow,
} from "../lib/recaps";
import { holdHex } from "../lib/constants";
import { routeLabel } from "../lib/routeLabel";
import { fetchNotifications } from "../lib/notifications";
import { AppHeader } from "../components/Layout";
import { RouteGradeStack } from "../components/RouteGradeStack";
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
  return `${days} day${days === 1 ? "" : "s"} open`;
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
  const [offGrid, setOffGrid] = useState<PersonalLogRow[]>([]);
  const [transferGym, setTransferGym] = useState<{ id: string; name: string } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [latestRecap, setLatestRecap] = useState<RecapRow | null>(null);
  const [story, setStory] = useState<RecapRow | null>(null);
  const [unread, setUnread] = useState(0);
  const [gymName, setGymName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"logged" | "projecting">("logged");

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

  // Off-grid climbs are real climbs and count toward the user's own numbers.
  // A gym-less user (no active gym) sees them folded into the home hero and
  // streak; once they have a gym, the home view stays scoped to that gym and
  // off-grid climbs live only in their own labelled section below.
  const offGridLogged = useMemo(
    () => offGridToLoggedItems(offGrid).logged,
    [offGrid],
  );
  const statInput = useMemo(
    () => (activeGymId ? scopedLogged : [...scopedLogged, ...offGridLogged]),
    [activeGymId, scopedLogged, offGridLogged],
  );

  // Hero "Sends" count includes off-grid when gym-less; the grouped list below
  // only ever shows gym-linked sends (off-grid rows have no route to open).
  const cleanSends = useMemo(
    () => statInput.filter((l) => l.sendType !== "topped"),
    [statInput],
  );
  const gymSends = useMemo(
    () => scopedLogged.filter((l) => l.sendType !== "topped"),
    [scopedLogged],
  );

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

      // Work out whether a real gym is now available to move off-grid climbs
      // into: the home gym they just set, or their suggested gym once approved.
      let target: { id: string; name: string } | null = null;
      if (book.offGrid.length > 0) {
        if (profile.home_gym_id) {
          const { data: home } = await supabase
            .from("gyms")
            .select("id, name")
            .eq("id", profile.home_gym_id)
            .maybeSingle();
          if (home) target = { id: home.id, name: home.name };
        } else {
          const match = await findApprovedGymForLabel(
            profile.offgrid_gym_label,
            book.offGrid,
          );
          if (match) target = { id: match.id, name: match.name };
        }
      }

      if (!active) return;
      setLogged(book.logged);
      setProjects(book.projects);
      setOffGrid(book.offGrid);
      setTransferGym(target);
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
  }, [profile, reloadKey]);

  const stats = useMemo(
    () => computeLogStats(statInput, system),
    [statInput, system],
  );

  const groups = useMemo(() => {
    const out: { label: string; items: LoggedItem[] }[] = [];
    for (const item of gymSends) {
      const label = groupLabel(item.date);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [gymSends]);

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
          view === "logged" ? "Sends" : "Projects"
        }
        subtitle={
          gymName
            ? `Klimbing out of ${gymName}${isVisiting ? " (visiting)" : ""}`
            : "Your Klimbing history"
        }
        right={
          <button
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-chalk"
          >
            <Bell size={22} />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-extrabold leading-none text-bg ring-2 ring-bg">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </button>
        }
      />

      {loading ? (
        <CenterSpinner />
      ) : scopedLogged.length === 0 &&
        scopedProjects.length === 0 &&
        offGrid.length === 0 ? (
        /* First-run: a warm nudge straight to the first log. */
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10">
            <TrendingUp size={36} className="text-accent" />
          </span>
          <h2 className="text-xl font-extrabold text-chalk">
            Your logbook starts here
          </h2>
          <p className="max-w-xs text-sm text-muted">
            Log your first Klimb and this page fills with your history, grade
            pyramid, streaks, and a weekly recap every Sunday.
          </p>
          <Button onClick={() => navigate("/log")}>
            <Plus size={18} className="mr-2" /> Log my first Klimb
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
                  Klimbing is in 🎬
                </p>
              </button>
            ) : (
              <p className="ml-1 flex items-center gap-1.5 text-xs text-faint">
                <Sparkles size={12} className="text-accent" /> Next weekly recap
                in {recapCountdownLabel()}
              </p>
            )}
          </div>

          {/* ---- Transfer prompt: their gym is on Klimb now ---- */}
          {transferGym && offGrid.length > 0 && !bannerDismissed ? (
            <div className="px-5 pt-3">
              <div className="relative overflow-hidden rounded-3xl bg-accent/10 p-4 shadow-card ring-1 ring-accent/40">
                <button
                  onClick={() => setBannerDismissed(true)}
                  aria-label="Dismiss"
                  className="absolute right-3 top-3 rounded-full p-1 text-faint transition hover:text-chalk"
                >
                  <X size={16} />
                </button>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent">
                  <ArrowRightLeft size={13} /> Ready to move in
                </p>
                <p className="mt-1 pr-6 text-sm font-semibold text-chalk">
                  {transferGym.name} is on Klimb now
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  Move your {offGrid.length} off-grid climb
                  {offGrid.length === 1 ? "" : "s"} in and{" "}
                  {offGrid.length === 1 ? "it becomes a" : "they become"} normal
                  logged climb{offGrid.length === 1 ? "" : "s"} — original dates
                  and all.
                </p>
                <Button className="mt-3" onClick={() => setTransferOpen(true)}>
                  <ArrowRightLeft size={16} className="mr-2" />
                  Transfer {offGrid.length} climb
                  {offGrid.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          ) : null}

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
                    ? "Sends"
                    : "Projects"}
                </button>
              ))}
            </div>
          </div>

          {view === "logged" ? (
            <div className="flex flex-col gap-5 px-5 pb-6">
              {offGrid.length > 0 ? (
                <OffGridSection
                  logs={offGrid}
                  system={system}
                  action={
                    transferGym ? (
                      <button
                        onClick={() => setTransferOpen(true)}
                        className="flex items-center gap-1 text-xs font-bold text-accent"
                      >
                        <ArrowRightLeft size={13} /> Transfer to my gym
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate("/gyms")}
                        className="text-xs font-semibold text-faint transition hover:text-accent"
                      >
                        Add your gym
                      </button>
                    )
                  }
                />
              ) : null}

              {gymSends.length === 0 ? (
                offGrid.length === 0 ? (
                  <Empty text="No sends at this gym yet. Tap Log to record your first Klimb here." />
                ) : null
              ) : (
                groups.map((g) => (
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
                          userGrade={item.userGrade}
                        />
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          ) : scopedProjects.length === 0 ? (
            <Empty text="Nothing on the project board here. Log a Klimb as 'Project' to add one." />
          ) : (
            <ul className="flex flex-col gap-2 px-5 pb-6">
              {scopedProjects.map((p, i) => (
                <RowLink
                  key={p.route.id}
                  route={p.route}
                  system={system}
                  index={i}
                  to={`/project/${p.route.id}`}
                  badge={p.topped ? <Badge tone="accent"><Check size={12} /> Topped</Badge> : <Badge tone="muted"><Bookmark size={12} /> In progress</Badge>}
                  sub={daysOpen(p.since)}
                  note={p.notePeek}
                  userGrade={p.userGrade}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {story ? (
        <WeeklyRecap recap={story} system={system} onClose={() => setStory(null)} />
      ) : null}

      {transferGym ? (
        <TransferOffGridSheet
          open={transferOpen}
          gym={transferGym}
          logs={offGrid}
          onClose={() => setTransferOpen(false)}
          onDone={() => setReloadKey((k) => k + 1)}
        />
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
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
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
  userGrade,
  to,
}: {
  route: RouteWithStats;
  system: "american" | "european";
  index: number;
  badge: React.ReactNode;
  sub: string;
  note?: string | null;
  userGrade?: number | null;
  /** Override destination (projects open their journal, not the route). */
  to?: string;
}) {
  return (
    <li className="relative" style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}>
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
            <span className="truncate">{routeLabel(route)}</span>
            {route.status === "archived" ? (
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-faint">
                Archived
              </span>
            ) : null}
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            {badge}
            <span className="min-w-0 truncate whitespace-nowrap text-xs text-muted">
              {sub}
            </span>
          </div>
          {note ? (
            <p className="mt-1 truncate text-xs italic text-faint">"{note}"</p>
          ) : null}
        </div>
        <RouteGradeStack
          route={route}
          system={system}
          userGrade={userGrade}
        />
      </Link>
    </li>
  );
}
