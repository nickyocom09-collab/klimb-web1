import { Link } from "react-router-dom";
import { Check, Plus, Trophy, Users, Video } from "lucide-react";
import {
  communityGrade,
  formatGrade,
  gradeDistribution,
  gradeSpread,
  spreadColor,
  type GradeSystem,
} from "../lib/grades";
import { holdHex } from "../lib/constants";
import type { RouteWithStats } from "../lib/routes";

export function RouteCard({
  route,
  system = "american",
  index = 0,
  myGrade = null,
  onGrade,
}: {
  route: RouteWithStats;
  system?: GradeSystem;
  index?: number;
  /** The current user's own submitted grade for this route, if any. */
  myGrade?: number | null;
  /** Opens the quick-grade sheet for this route. */
  onGrade?: (route: RouteWithStats) => void;
}) {
  const values = route.gradeValues;
  const n = values.length;
  const grade = communityGrade(values);
  const dist = gradeDistribution(values);
  const maxCount = dist.length ? Math.max(...dist.map((d) => d.count)) : 0;
  const color = spreadColor(values);

  // The community verdict, at a glance: is the crowd agreed or split?
  let verdict: { label: string; tone: "green" | "orange" | "faint" };
  if (n === 0) {
    verdict = { label: "No grades yet — be the first", tone: "faint" };
  } else if (n === 1) {
    verdict = { label: "1 grade so far", tone: "faint" };
  } else if (gradeSpread(values) <= 1) {
    verdict = { label: "Strong consensus", tone: "green" };
  } else {
    const min = Math.min(...values);
    const max = Math.max(...values);
    verdict = {
      label: `Contested · ${formatGrade(min, route.climbing_type, system)}–${formatGrade(
        max,
        route.climbing_type,
        system,
      )}`,
      tone: "orange",
    };
  }
  const toneClass =
    verdict.tone === "green"
      ? "text-accent"
      : verdict.tone === "orange"
        ? "text-wide"
        : "text-faint";

  return (
    <div
      style={{ animationDelay: `${Math.min(index * 45, 270)}ms` }}
      className="animate-fade-up overflow-hidden rounded-3xl border border-border bg-surface shadow-card"
    >
      <Link
        to={`/route/${route.id}`}
        className="block transition active:scale-[0.99]"
      >
        <div className="relative aspect-[4/3] w-full bg-surface-2">
          <img
            src={route.photo_url}
            alt={`${route.hold_color} route on ${route.wall_section}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {route.video_url ? (
            <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-bg/80 px-2 py-1 backdrop-blur">
              <Video size={13} className="text-chalk" />
            </div>
          ) : null}
          {/* Community grade — the hero of the card. */}
          <div className="absolute right-3 top-3 flex flex-col items-center rounded-2xl bg-bg/80 px-3 py-1.5 backdrop-blur">
            <span className="text-3xl font-extrabold leading-none text-accent">
              {formatGrade(grade, route.climbing_type, system)}
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
              community
            </span>
          </div>
        </div>

        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-white/10"
                style={{ backgroundColor: holdHex(route.hold_color) }}
              />
              <div>
                <p className="font-semibold text-chalk">{route.hold_color}</p>
                <p className="text-sm text-muted">{route.wall_section}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted">
              <span className="flex items-center gap-1">
                <Users size={15} />
                {n}
              </span>
              <span className="flex items-center gap-1">
                <Trophy size={15} />
                {route.sendCount}
              </span>
            </div>
          </div>

          {/* Verdict: consensus label + a slim distribution so you can see the
              shape of what people think in one glance. */}
          <div className="mt-3 flex items-center gap-3">
            {n > 0 ? (
              <div className="flex h-6 items-end gap-0.5">
                {dist.map((d) => (
                  <div
                    key={d.grade}
                    className="w-1.5 rounded-sm"
                    style={{
                      height: `${maxCount > 0 ? Math.max((d.count / maxCount) * 100, d.count > 0 ? 22 : 0) : 0}%`,
                      backgroundColor: d.count > 0 ? color : "rgb(var(--c-border))",
                      minHeight: d.count > 0 ? "0.25rem" : "0.15rem",
                    }}
                  />
                ))}
              </div>
            ) : null}
            <span className={`text-xs font-semibold ${toneClass}`}>
              {verdict.label}
            </span>
          </div>
        </div>
      </Link>

      {/* One-tap grading — the walk-up "here's my take" moment. */}
      {onGrade ? (
        <button
          onClick={() => onGrade(route)}
          className={`flex w-full items-center justify-center gap-2 border-t border-border py-3 text-sm font-semibold transition ${
            myGrade !== null
              ? "text-accent hover:bg-accent/5"
              : "text-muted hover:text-chalk"
          }`}
        >
          {myGrade !== null ? (
            <>
              <Check size={16} /> You graded{" "}
              {formatGrade(myGrade, route.climbing_type, system)} · change
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
