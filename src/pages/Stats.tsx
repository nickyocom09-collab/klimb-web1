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
        <div className="flex flex-col gap-3 px-5 pb-6 pt-1">
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

          {/* ---- All-time numbers ---- */}
          <div className="grid grid-cols-3 gap-2">
            <Tile n={String(stats.total)} label="Sends" />
            <Tile n={String(stats.flashes)} label="Flashes" />
            <Tile
              n={stats.flashRate !== null ? `${stats.flashRate}%` : "—"}
              label="Flash rate"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface px-4 py-3 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Hardest send
              </p>
              <p className="mt-0.5 text-2xl font-extrabold leading-tight text-accent">
                {formatHardest(stats.hardestSend, system)}
              </p>
            </div>
            <div className="rounded-2xl bg-surface px-4 py-3 shadow-card">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                <Zap size={11} className="text-accent" /> Hardest flash
              </p>
              <p className="mt-0.5 text-2xl font-extrabold leading-tight text-chalk">
                {formatHardest(stats.hardestFlash, system)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Tile n={String(stats.sessions)} label="Sessions" />
            <Tile n={String(stats.attemptsTotal)} label="Total tries" />
            <Tile n={stats.topWall ?? "—"} label="Fav wall" small />
          </div>

          {/* All-time pyramid */}
          {stats.pyramid.length > 0 ? (
            <div className="rounded-2xl bg-surface p-4 shadow-card">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-faint">
                <TrendingUp size={14} className="text-accent" /> All-time
                pyramid
              </h2>
              <div className="flex flex-col gap-1.5">
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

          {/* Weekly volume */}
          <div className="rounded-2xl bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
                Last 8 weeks
              </h2>
              <span className="text-xs tabular-nums text-muted">
                {stats.thisWeek} this week ·{" "}
                {stats.thisWeek - stats.lastWeek >= 0 ? "+" : ""}
                {stats.thisWeek - stats.lastWeek} vs last
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
                />
              ))}
            </div>
          </div>

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

          {logged.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-faint">
              Log your first climb and this page comes alive — pyramid, streaks,
              recaps, all of it.
            </p>
          ) : null}
        </div>
      )}

      {story ? (
        <RecapStory recap={story} system={system} onClose={() => setStory(null)} />
      ) : null}
    </div>
  );
}

function Tile({
  n,
  label,
  small = false,
}: {
  n: string;
  label: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-3 text-center shadow-card">
      <p
        className={`font-extrabold tabular-nums text-chalk ${small ? "truncate text-base leading-8" : "text-2xl"}`}
      >
        {n}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
