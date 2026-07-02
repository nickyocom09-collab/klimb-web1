import { Link } from "react-router-dom";
import { Check, Flame, Plus, Sparkles, Star, Trophy, Video } from "lucide-react";
import {
  communityGrade,
  formatGradeStyled,
  gradeConsensus,
  gradeDistribution,
  spreadColor,
  type GradeSystem,
} from "../lib/grades";
import { holdHex } from "../lib/constants";
import { isNewThisWeek, isTrending, type RouteWithStats } from "../lib/routes";

export function RouteCard({
  route,
  system = "american",
  index = 0,
  myGrade = null,
  authorName = null,
  onGrade,
}: {
  route: RouteWithStats;
  system?: GradeSystem;
  index?: number;
  myGrade?: number | null;
  authorName?: string | null;
  onGrade?: (route: RouteWithStats) => void;
}) {
  const values = route.gradeValues;
  const n = values.length;
  const community = communityGrade(values);
  const dist = gradeDistribution(values);
  const maxCount = dist.length ? Math.max(...dist.map((d) => d.count)) : 0;
  const color = spreadColor(values);
  const { tone } = gradeConsensus(values);
  const fmt = (g: number | null) =>
    formatGradeStyled(g, route.climbing_type, system, route.gradingStyle);

  let verdict = "No grades yet — be the first";
  if (n === 1) verdict = "1 grade so far";
  else if (n > 1 && tone === "green") verdict = "Strong consensus";
  else if (n > 1) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const lo = fmt(min);
    const hi = fmt(max);
    verdict = lo === hi ? "Strong consensus" : `Contested · ${lo}–${hi}`;
  }
  const toneClass =
    tone === "green"
      ? "text-accent"
      : tone === "orange"
        ? "text-wide"
        : "text-faint";

  return (
    <div
      style={{ animationDelay: `${Math.min(index * 45, 270)}ms` }}
      className="animate-fade-up overflow-hidden rounded-3xl bg-surface shadow-card"
    >
      <Link to={`/route/${route.id}`} className="block transition active:scale-[0.99]">
        {/* Author strip */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-bold uppercase text-accent">
            {(authorName ?? "?").charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-chalk">
              {authorName ?? "Climber"}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <span
                className="h-2.5 w-2.5 rounded-full border border-white/10"
                style={{ backgroundColor: holdHex(route.hold_color) }}
              />
              {route.hold_color} · {route.wall_section}
            </p>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full bg-surface-2">
          <img
            src={route.photo_url}
            alt={`${route.hold_color} route on ${route.wall_section}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {/* Freshness / heat badges */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            {isNewThisWeek(route) ? (
              <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-bg shadow-lg">
                <Sparkles size={11} /> New this week
              </span>
            ) : null}
            {isTrending(route) ? (
              <span className="flex items-center gap-1 rounded-full bg-wide px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-bg shadow-lg">
                <Flame size={11} /> Trending
              </span>
            ) : null}
            {route.video_url ? (
              <span className="flex items-center gap-1 rounded-full bg-bg/80 px-2 py-1 backdrop-blur">
                <Video size={13} className="text-chalk" />
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-4">
          {/* Community says vs gym says */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl bg-surface-2 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Community says
              </p>
              <p className="mt-0.5 text-3xl font-extrabold leading-none text-accent">
                {fmt(community)}
              </p>
              <p className="mt-1 text-[11px] text-faint">
                {n} vote{n === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex-1 rounded-2xl bg-surface-2 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Gym says
              </p>
              <p className="mt-0.5 text-3xl font-extrabold leading-none text-chalk">
                {route.gym_grade === null || route.gym_grade === undefined
                  ? "—"
                  : fmt(route.gym_grade)}
              </p>
              <p className="mt-1 text-[11px] text-faint">
                {route.gym_grade === null || route.gym_grade === undefined
                  ? "not set"
                  : "official"}
              </p>
            </div>
          </div>

          {/* Verdict + slim distribution */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`text-xs font-semibold ${toneClass}`}>{verdict}</span>
            <div className="flex items-center gap-3">
              {n > 0 ? (
                <div className="flex h-5 items-end gap-0.5">
                  {dist.map((d) => (
                    <div
                      key={d.grade}
                      className="w-1.5 rounded-sm"
                      style={{
                        height: `${maxCount > 0 ? Math.max((d.count / maxCount) * 100, d.count > 0 ? 24 : 0) : 0}%`,
                        backgroundColor:
                          d.count > 0 ? color : "rgb(var(--c-border))",
                        minHeight: d.count > 0 ? "0.25rem" : "0.15rem",
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {route.funCount > 0 && route.funAvg !== null ? (
                <span className="flex items-center gap-1 text-sm text-muted">
                  <Star
                    size={15}
                    className="text-accent"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                  {route.funAvg.toFixed(1)}
                </span>
              ) : null}
              <span className="flex items-center gap-1 text-sm text-muted">
                <Trophy size={15} />
                {route.sendCount}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {onGrade ? (
        <button
          onClick={() => onGrade(route)}
          className={`flex w-full items-center justify-center gap-2 border-t border-border/60 py-3 text-sm font-semibold transition ${
            myGrade !== null
              ? "text-accent hover:bg-accent/5"
              : "text-muted hover:text-chalk"
          }`}
        >
          {myGrade !== null ? (
            <>
              <Check size={16} /> You said {fmt(myGrade)} · change
            </>
          ) : (
            <>
              <Plus size={16} /> Add your grade
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
