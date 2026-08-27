import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  Clapperboard,
  Lock,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  computeLogStats,
  fetchLogbook,
  hardestParts,
  type LoggedItem,
} from "../lib/logstats";
import { offGridToLoggedItems } from "../lib/personalLogs";
import { formatGradeStyled } from "../lib/grades";
import {
  fetchRecaps,
  markRecapSeen,
  recapCountdownLabel,
  type RecapRow,
} from "../lib/recaps";
import { AppHeader } from "../components/Layout";
import { WeeklyRecap } from "../components/WeeklyRecap";
import { StreakFire } from "../components/StreakFire";
import { CenterSpinner } from "../components/ui";
import { useEntitlements } from "../lib/entitlements";
import { supabase } from "../lib/supabase";

function periodLabel(r: RecapRow): string {
  const d = new Date(`${r.period_start}T00:00:00`);
  if (r.period === "weekly") {
    return `Week of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// The deep-stats + recaps hub. Everything is the user's own numbers — the
// place to celebrate progress, and where weekly/monthly recaps live on.
export function Stats() {
  const { profile } = useAuth();
  const { hasProAccess } = useEntitlements();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";

  const [logged, setLogged] = useState<LoggedItem[]>([]);
  const [recaps, setRecaps] = useState<RecapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<RecapRow | null>(null);
  const [favoriteGym, setFavoriteGym] = useState<string | null>(null);
  const [gymInsights, setGymInsights] = useState<{ name: string; count: number }[]>([]);
  const [trendRange, setTrendRange] = useState<"8w" | "6m" | "1y" | "all">("8w");
  const [showAllRecaps, setShowAllRecaps] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    (async () => {
      const [book, rec] = await Promise.all([
        fetchLogbook(profile.id),
        fetchRecaps(profile.id),
      ]);
      if (!active) return;
      // Off-grid climbs are real climbs — fold them into every all-time number,
      // streak, and pyramid, exactly like gym-linked climbs.
      const off = offGridToLoggedItems(book.offGrid).logged;
      const allLogged = [...book.logged, ...off];
      setLogged(allLogged);
      setRecaps(rec.history);
      const gymCounts = new Map<string, number>();
      for (const item of book.logged) {
        gymCounts.set(item.route.gym_id, (gymCounts.get(item.route.gym_id) ?? 0) + 1);
      }
      const rankedGyms = [...gymCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (rankedGyms.length > 0) {
        const { data: gyms } = await supabase.from("gyms").select("id, name").in("id", rankedGyms.map(([id]) => id));
        const names = new Map((gyms ?? []).map((gym) => [gym.id, gym.name]));
        const insights = rankedGyms.map(([id, count]) => ({ name: names.get(id) ?? "Gym", count }));
        if (active) {
          setFavoriteGym(insights[0]?.name ?? null);
          setGymInsights(insights);
        }
      } else {
        setFavoriteGym(null);
        setGymInsights([]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  const stats = useMemo(
    () => computeLogStats(logged, system),
    [logged, system],
  );
  const latestWeekly = recaps.find((recap) => recap.period === "weekly") ?? null;
  const latest = hasProAccess ? (recaps[0] ?? null) : latestWeekly;
  const trendBuckets = useMemo(() => buildTrendBuckets(logged, trendRange), [logged, trendRange]);
  const trendMax = Math.max(...trendBuckets, 1);
  const logsWithAttempts = logged.filter((item) => item.attempts && item.attempts > 0);
  const attemptsPerSend = logsWithAttempts.length
    ? logsWithAttempts.reduce((sum, item) => sum + (item.attempts ?? 0), 0) / logsWithAttempts.length
    : null;
  const timeOfDay = useMemo(() => favoriteTimeOfDay(logged), [logged]);
  const thisMonth = logged.filter((item) => {
    const date = new Date(item.date);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
  const pastRecaps = recaps.filter((recap) => recap.id !== latest?.id);
  const visiblePastRecaps = showAllRecaps ? pastRecaps : pastRecaps.slice(0, 10);

  function openStory(r: RecapRow) {
    if (!hasProAccess && r.id !== latestWeekly?.id) {
      navigate("/upgrade");
      return;
    }
    setStory(r);
    if (!r.seen_at) {
      markRecapSeen(r.id);
      setRecaps((prev) =>
        prev.map((x) =>
          x.id === r.id ? { ...x, seen_at: new Date().toISOString() } : x,
        ),
      );
    }
  }

  useEffect(() => {
    if (loading || recaps.length === 0) return;
    const recapId = searchParams.get("recap");
    if (!recapId) return;
    const requested = recaps.find((r) => r.id === recapId);
    if (requested) openStory(requested);
    setSearchParams({}, { replace: true });
    // openStory is intentionally driven once by the URL after recaps load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, recaps, searchParams, setSearchParams]);

  return (
    <div>
      <AppHeader title="Stats" subtitle="Your climbing, in numbers" />

      {loading ? (
        <CenterSpinner />
      ) : (
        <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
          {/* ---- Recaps hub ---- */}
          {latest ? (
            <button
              onClick={() => openStory(latest)}
              className={`relative overflow-hidden rounded-3xl p-5 text-left shadow-card transition active:scale-[0.99] ${
                !latest.seen_at
                  ? "bg-accent/10 ring-1 ring-accent/40"
                  : "bg-surface"
              }`}
            >
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent">
                <Clapperboard size={13} />
                {latest.period === "weekly" ? "Weekly recap" : "Monthly recap"}
                {!latest.seen_at ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[9px] text-bg">
                    NEW
                  </span>
                ) : null}
              </p>
              <p className="mt-1.5 text-xl font-extrabold text-chalk">
                Your {latest.period === "weekly" ? "week" : "month"} in climbing
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {periodLabel(latest)} · {latest.payload.climbs} climb
                {latest.payload.climbs === 1 ? "" : "s"} · tap to watch
              </p>
            </button>
          ) : (
            <div className="rounded-3xl bg-surface p-5 shadow-card">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent">
                <Sparkles size={13} /> Weekly recap
              </p>
              <p className="mt-1.5 font-semibold text-chalk">
                Your first recap drops Sunday 7 PM
              </p>
              <p className="mt-0.5 text-sm text-muted">
                in {recapCountdownLabel()} — log some climbs this week and it'll
                be a good one.
              </p>
            </div>
          )}

          {logged.length === 0 ? (
            /* Low data: encouragement, not a wall of zeros. */
            <div className="rounded-3xl bg-surface px-6 py-10 text-center shadow-card">
              <p className="text-lg font-extrabold text-chalk">
                Your numbers start with one climb
              </p>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                Log your first send and this page fills in — hardest climbs,
                grade pyramid, weekly volume, and a recap every Sunday.
              </p>
            </div>
          ) : (
            <>
          {/* Headline totals stay scannable instead of competing for space. */}
          <div className="rounded-3xl bg-surface p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
              All-time activity
            </p>
            <div className="mt-4 grid grid-cols-3 divide-x divide-border/60">
              <Metric value={logged.length} label="Klimbs logged" accent />
              <Metric value={stats.total} label="Sends" />
              <Metric value={stats.flashes} label="Flashes" />
            </div>
            {hasProAccess && stats.flashRate !== null ? (
              <p className="mt-4 border-t border-border/50 pt-3 text-center text-xs text-muted">
                {stats.flashRate}% of your sends happened first try
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-surface px-3 py-4 text-center shadow-card">
              <p className="text-xl font-extrabold tabular-nums text-chalk">{stats.thisWeek}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-faint">This week</p>
            </div>
            <div className="rounded-2xl bg-surface px-3 py-4 text-center shadow-card">
              <p className="text-xl font-extrabold tabular-nums text-chalk">{thisMonth}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-faint">This month</p>
            </div>
            <div className="min-w-0 rounded-2xl bg-surface px-3 py-4 text-center shadow-card">
              <p className="break-words text-xs font-extrabold leading-tight text-chalk">{favoriteGym ?? "None yet"}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-faint">Favorite gym</p>
            </div>
          </div>

          {/* A compact read on the grades this climber usually sends. */}
          {logged.length > 0 ? (
            <div className="overflow-hidden rounded-3xl border border-accent/15 bg-surface p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Average grade</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["boulder", "toprope", "lead"] as const).map((type) => {
                  const grade = stats.averageGrade[type];
                  return (
                    <div key={type} className="flex min-h-24 flex-col items-center justify-center rounded-2xl bg-surface-2 px-2 py-3 text-center">
                      <p className={`klimb-grade font-extrabold ${grade === null ? "text-xs leading-tight text-muted" : "text-2xl text-accent"}`}>
                        {grade === null ? "None logged yet" : formatGradeStyled(grade, type, system, "classic")}
                      </p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-faint">
                        {type === "boulder" ? "Boulder" : type === "toprope" ? "Top Rope" : "Lead"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* ---- Streak: an animated flame, counted in days ---- */}
          <div className="flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-card">
            <StreakFire streak={stats.streakWeeks} size={52} />
            <div className="min-w-0">
              <p className="text-2xl font-extrabold leading-none tabular-nums text-chalk">
                {stats.streakWeeks > 0
                  ? `${stats.streakWeeks} week${stats.streakWeeks === 1 ? "" : "s"}`
                  : "No streak"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {stats.streakWeeks > 0
                  ? "Streak's alive — just one log a week keeps it burning."
                  : "Log a Klimb this week to spark your streak."}
              </p>
            </div>
          </div>

          {/* ---- Personal bests: clean rows, grade sits on the right ---- */}
          <div className="rounded-3xl bg-surface p-5 shadow-card">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-faint">
              Personal bests
            </h2>
            <div className="mt-2 flex flex-col divide-y divide-border/50">
              <div className="py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
                  <Trophy size={16} className="text-accent" /> Hardest send
                </span>
                <HardestValue
                  parts={hardestParts(stats.hardestSend, system)}
                  tone="text-accent"
                />
              </div>
              {hasProAccess ? <div className="py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
                  <Zap size={16} className="text-accent" /> Hardest flash
                </span>
                <HardestValue
                  parts={hardestParts(stats.hardestFlash, system)}
                  tone="text-chalk"
                />
              </div> : null}
            </div>
          </div>

          {/* Boulder and rope grades live on different scales. Keep them in
              one card, but never blend them into a misleading chart. */}
          {stats.pyramids.boulder.length > 0 ||
          stats.pyramids.rope.length > 0 ? (
            <div className="rounded-3xl bg-surface p-5 shadow-card">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-faint">
                <TrendingUp size={14} className="text-accent" /> Grade pyramid
              </h2>
              <p className="mb-4 mt-1 text-sm text-muted">
                Your sends by grade, with Boulder and Rope kept separate.
              </p>
              <div className="flex flex-col gap-5">
                {stats.pyramids.boulder.length > 0 ? (
                  <PyramidChart
                    label="Boulder"
                    rows={stats.pyramids.boulder}
                  />
                ) : null}
                {stats.pyramids.rope.length > 0 ? (
                  <PyramidChart label="Rope" rows={stats.pyramids.rope} />
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-3xl">
            <div className={`${hasProAccess ? "" : "pointer-events-none select-none blur-[5px] opacity-60"}`} aria-hidden={!hasProAccess}>
              <div className="rounded-3xl bg-surface p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Progress over time</h2>
                    <p className="mt-1 text-sm text-muted">Every bar comes directly from your saved Klimbs.</p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-accent">Pro</span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-bg p-1">
                  {([['8w', '8W'], ['6m', '6M'], ['1y', '1Y'], ['all', 'All']] as const).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setTrendRange(value)} className={`rounded-lg py-2 text-[10px] font-extrabold ${trendRange === value ? 'bg-accent text-bg' : 'text-faint'}`}>{label}</button>
                  ))}
                </div>
                <div className="mt-5 flex h-24 items-end gap-1.5">
                  {trendBuckets.map((count, index) => (
                    <div key={index} className={`flex-1 rounded-t-md ${index === trendBuckets.length - 1 ? 'bg-accent' : 'bg-surface-2'}`} style={{ height: `${Math.max((count / trendMax) * 100, count > 0 ? 12 : 4)}%` }} title={`${count} Klimbs`} />
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <InsightMetric value={stats.flashRate === null ? '—' : `${stats.flashRate}%`} label="Flash rate" />
                  <InsightMetric value={attemptsPerSend === null ? '—' : attemptsPerSend.toFixed(1)} label="Attempts / send" />
                  <InsightMetric value={timeOfDay} label="Best time" />
                </div>
                {gymInsights.length > 0 ? (
                  <div className="mt-5 border-t border-border/60 pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-faint">Your gyms</p>
                    <div className="mt-2 grid gap-2">
                      {gymInsights.map((gym, index) => (
                        <div key={gym.name} className="flex items-start justify-between gap-3 rounded-xl bg-bg px-3 py-2.5 text-sm"><span className="min-w-0 flex-1 break-words font-semibold leading-snug text-chalk">{index + 1}. {gym.name}</span><span className="shrink-0 pt-0.5 text-xs font-bold text-accent">{gym.count} Klimbs</span></div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {!hasProAccess ? (
              <button
                type="button"
                onClick={() => navigate("/upgrade")}
                className="absolute inset-0 flex flex-col items-center justify-center bg-bg/35 px-8 text-center"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-bg"><Lock size={19} /></span>
                <span className="mt-3 text-lg font-extrabold text-chalk">See how your climbing changes</span>
                <span className="mt-1 max-w-xs text-xs leading-5 text-muted">Pro unlocks time ranges, flash rate, attempts per send, preferred time, and gym insights.</span>
                <span className="mt-4 rounded-full bg-accent px-5 py-2.5 text-xs font-extrabold text-bg">Explore Klimb Pro</span>
              </button>
            ) : null}
          </div>

            </>
          )}

          {/* Past recaps */}
          {recaps.length > 1 ? (
            <section>
              <h2 className="mb-2 ml-1 text-sm font-semibold uppercase tracking-wide text-faint">
                Past recaps
              </h2>
              <ul className="flex flex-col gap-1.5">
                {visiblePastRecaps.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => openStory(r)}
                      className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left shadow-card transition active:scale-[0.99]"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-chalk">
                          {periodLabel(r)}
                        </span>
                        <span className="text-xs text-muted">
                          {r.payload.climbs} climbs · {r.payload.sends} sends
                        </span>
                      </span>
                      {hasProAccess ? <ChevronRight size={16} className="text-faint" /> : <Lock size={15} className="text-accent" />}
                    </button>
                  </li>
                ))}
              </ul>
              {pastRecaps.length > 10 ? (
                <button type="button" onClick={() => setShowAllRecaps((current) => !current)} className="mt-3 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-bold text-accent">
                  {showAllRecaps ? "Show less" : `View all ${pastRecaps.length} recaps`}
                </button>
              ) : null}
            </section>
          ) : null}

        </div>
      )}

      {story ? (
        <WeeklyRecap recap={story} system={system} onClose={() => setStory(null)} />
      ) : null}
    </div>
  );
}

/** Hardest grade shown as separate, labeled boulder + rope values. */
function HardestValue({
  parts,
  tone,
}: {
  parts: { boulder: string | null; toprope: string | null; lead: string | null };
  tone: string;
}) {
  const items = [
    { g: parts.boulder, t: "Boulder" },
    { g: parts.toprope, t: "Top Rope" },
    { g: parts.lead, t: "Lead" },
  ];
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.t} className="rounded-xl bg-surface-2 px-3 py-2.5 text-left leading-none">
          <p className={`klimb-grade font-extrabold ${it.g ? `text-xl ${tone}` : "text-[10px] leading-tight text-muted"}`}>
            {it.g ?? "None logged yet"}
          </p>
          <p className="mt-1.5 truncate text-[9px] font-semibold uppercase tracking-wide text-faint">
            {it.t}
          </p>
        </div>
      ))}
    </div>
  );
}

function Metric({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`text-3xl font-extrabold leading-none tabular-nums ${accent ? "text-accent" : "text-chalk"}`}>
        {value}
      </p>
      <p className="mx-auto mt-1.5 max-w-[5.5rem] text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-muted">
        {label}
      </p>
    </div>
  );
}

function InsightMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-bg px-2 py-3 text-center">
      <p className="truncate text-lg font-extrabold tabular-nums text-chalk">{value}</p>
      <p className="mt-1 text-[8px] font-bold uppercase leading-tight tracking-wide text-faint">{label}</p>
    </div>
  );
}

function favoriteTimeOfDay(logged: LoggedItem[]) {
  if (logged.length === 0) return "—";
  const counts = { Morning: 0, Afternoon: 0, Evening: 0 };
  for (const item of logged) {
    const hour = new Date(item.date).getHours();
    if (hour < 12) counts.Morning += 1;
    else if (hour < 17) counts.Afternoon += 1;
    else counts.Evening += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—");
}

function buildTrendBuckets(
  logged: LoggedItem[],
  range: "8w" | "6m" | "1y" | "all",
) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const earliest = logged.reduce(
    (min, item) => Math.min(min, new Date(item.date).getTime()),
    now,
  );
  const config = range === "8w"
    ? { buckets: 8, duration: 56 * day }
    : range === "6m"
      ? { buckets: 12, duration: 182 * day }
      : range === "1y"
        ? { buckets: 12, duration: 365 * day }
        : { buckets: 12, duration: Math.max(now - earliest + day, 12 * day) };
  const start = now - config.duration;
  const width = config.duration / config.buckets;
  const buckets = Array.from({ length: config.buckets }, () => 0);
  for (const item of logged) {
    const timestamp = new Date(item.date).getTime();
    if (timestamp < start || timestamp > now) continue;
    const index = Math.min(config.buckets - 1, Math.floor((timestamp - start) / width));
    if (index >= 0) buckets[index] += 1;
  }
  return buckets;
}

function PyramidChart({
  label,
  rows,
}: {
  label: string;
  rows: { label: string; count: number; sort: number }[];
}) {
  const max = Math.max(...rows.map((row) => row.count));
  const mostCommon = rows.reduce((a, b) => (b.count > a.count ? b : a));

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-chalk">
          {label}
        </h3>
        <p className="text-[11px] text-faint">
          Most at <span className="klimb-grade text-muted">{mostCommon.label}</span>
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="klimb-grade w-14 shrink-0 text-right text-xs font-semibold text-muted">
              {row.label}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full min-w-2 rounded-full bg-accent transition-[width]"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
            <span className="w-5 shrink-0 text-xs tabular-nums text-faint">
              {row.count}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
