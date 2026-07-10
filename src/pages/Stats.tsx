import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Clapperboard, Sparkles, TrendingUp, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  computeLogStats,
  fetchLogbook,
  formatHardest,
  type LoggedItem,
} from "../lib/logstats";
import {
  fetchRecaps,
  markRecapSeen,
  recapCountdownLabel,
  type RecapRow,
} from "../lib/recaps";
import { AppHeader } from "../components/Layout";
import { RecapStory } from "../components/RecapStory";
import { ListSkeleton } from "../components/ui";

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
  const system = profile?.grade_system ?? "american";

  const [logged, setLogged] = useState<LoggedItem[]>([]);
  const [recaps, setRecaps] = useState<RecapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<RecapRow | null>(null);

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
      setLogged(book.logged);
      setRecaps(rec.history);
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
  const latest = recaps[0] ?? null;
  const weekMax = Math.max(...stats.weeks, 1);

  function openStory(r: RecapRow) {
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

  return (
    <div>
      <AppHeader title="Stats" subtitle="Your climbing, in numbers" />

      {loading ? (
        <ListSkeleton rows={3} />
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
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/15 blur-2xl"
              />
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
          {/* ---- ONE headline moment ---- */}
          <div className="rounded-3xl bg-surface px-6 py-8 text-center shadow-card">
            <p className="text-6xl font-extrabold leading-none tabular-nums text-accent">
              {logged.length}
            </p>
            <p className="mt-2 text-base font-semibold text-chalk">
              climb{logged.length === 1 ? "" : "s"} logged
            </p>
            <p className="mt-1 text-sm text-muted">
              {stats.total} send{stats.total === 1 ? "" : "s"} ·{" "}
              {stats.flashes} flash{stats.flashes === 1 ? "" : "es"}
              {stats.flashRate !== null
                ? ` · ${stats.flashRate}% first try`
                : ""}
            </p>
          </div>

          {/* ---- The four numbers that matter ---- */}
          <div className="grid grid-cols-2 gap-3">
            <BigStat label="Hardest send" tone="accent">
              {formatHardest(stats.hardestSend, system)}
            </BigStat>
            <BigStat
              label="Hardest flash"
              icon={<Zap size={12} className="text-accent" />}
            >
              {formatHardest(stats.hardestFlash, system)}
            </BigStat>
            <BigStat
              label="This week"
              sub={
                stats.thisWeek - stats.lastWeek === 0
                  ? "same as last week"
                  : `${stats.thisWeek - stats.lastWeek > 0 ? "+" : ""}${stats.thisWeek - stats.lastWeek} vs last week`
              }
              subTone={
                stats.thisWeek - stats.lastWeek > 0
                  ? "accent"
                  : stats.thisWeek - stats.lastWeek < 0
                    ? "wide"
                    : "faint"
              }
            >
              {String(stats.thisWeek)}
            </BigStat>
            <BigStat label="Sessions">{String(stats.sessions)}</BigStat>
          </div>

          {/* Grade pyramid — one chart, one takeaway */}
          {stats.pyramid.length > 0 ? (
            <div className="rounded-3xl bg-surface p-5 shadow-card">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-faint">
                <TrendingUp size={14} className="text-accent" /> Grade pyramid
              </h2>
              <p className="mb-4 mt-1 text-sm text-muted">
                {(() => {
                  const top = stats.pyramid.reduce((a, b) =>
                    b.count > a.count ? b : a,
                  );
                  return `Most of your sends land at ${top.label}.`;
                })()}
              </p>
              <div className="flex flex-col gap-2">
                {stats.pyramid.map((b) => {
                  const max = Math.max(...stats.pyramid.map((x) => x.count));
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
                      <span className="w-5 shrink-0 text-xs tabular-nums text-faint">
                        {b.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Weekly volume — one chart, one takeaway */}
          <div className="rounded-3xl bg-surface p-5 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
              Last 8 weeks
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              {stats.thisWeek - stats.lastWeek > 0
                ? "You're climbing more than last week — keep it rolling."
                : stats.thisWeek - stats.lastWeek < 0
                  ? "A quieter week than last — the wall will be there."
                  : stats.thisWeek > 0
                    ? "Steady as she goes — same pace as last week."
                    : "Nothing logged yet this week."}
            </p>
            <div className="flex h-16 items-end gap-2">
              {stats.weeks.map((n, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t-md ${
                    i === 7 ? "bg-accent" : "bg-surface-2"
                  }`}
                  style={{
                    height: `${Math.max((n / weekMax) * 100, n > 0 ? 18 : 6)}%`,
                  }}
                />
              ))}
            </div>
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
                {recaps.slice(1).map((r) => (
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
                      <ChevronRight size={16} className="text-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

        </div>
      )}

      {story ? (
        <RecapStory recap={story} system={system} onClose={() => setStory(null)} />
      ) : null}
    </div>
  );
}

/** One big, plainly-labeled number — the only stat-card style on this page. */
function BigStat({
  label,
  children,
  sub,
  subTone = "faint",
  tone,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  sub?: string;
  subTone?: "accent" | "wide" | "faint";
  tone?: "accent";
  icon?: React.ReactNode;
}) {
  const subClass =
    subTone === "accent"
      ? "text-accent"
      : subTone === "wide"
        ? "text-wide"
        : "text-faint";
  return (
    <div className="rounded-3xl bg-surface px-4 py-5 shadow-card">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1.5 text-3xl font-extrabold leading-none tabular-nums ${
          tone === "accent" ? "text-accent" : "text-chalk"
        }`}
      >
        {children}
      </p>
      {sub ? <p className={`mt-1.5 text-xs ${subClass}`}>{sub}</p> : null}
    </div>
  );
}
