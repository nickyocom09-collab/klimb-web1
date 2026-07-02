import {
  communityGrade,
  distributionBuckets,
  formatGradeStyled,
  type ClimbingType,
  type GradeStyle,
  type GradeSystem,
} from "../lib/grades";

/**
 * Animated donut of how the community voted on a route's grade. Each distinct
 * grade is a slice; center shows the community verdict. Colors ramp green→amber
 * so a tight, agreed spread reads mostly green.
 */
export function GradeDonut({
  grades,
  climbingType = "boulder",
  system = "american",
  gradeStyle = "classic",
}: {
  grades: number[];
  climbingType?: ClimbingType;
  system?: GradeSystem;
  gradeStyle?: GradeStyle;
}) {
  const total = grades.length;
  const dist = distributionBuckets(grades, climbingType, system, gradeStyle).filter(
    (d) => d.count > 0,
  );
  const community = communityGrade(grades);

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-faint">
        No grades yet — be the first to vote.
      </p>
    );
  }

  const R = 54;
  const C = 2 * Math.PI * R;
  const colors = dist.map((_, i) =>
    dist.length === 1 ? "hsl(146 72% 52%)" : `hsl(${146 - (i / (dist.length - 1)) * 110} 72% 54%)`,
  );

  let offset = 0;
  const segments = dist.map((d, i) => {
    const frac = d.count / total;
    const len = frac * C;
    const seg = (
      <circle
        key={d.label}
        cx="70"
        cy="70"
        r={R}
        fill="none"
        stroke={colors[i]}
        strokeWidth={20}
        strokeLinecap="butt"
        strokeDasharray={`${len} ${C - len}`}
        strokeDashoffset={-offset}
        className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-out"
      />
    );
    offset += len;
    return seg;
  });

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0 animate-scale-in">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke="rgb(var(--c-surface-2))"
            strokeWidth={20}
          />
          {segments}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold leading-none text-accent">
            {formatGradeStyled(community, climbingType, system, gradeStyle)}
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
            {total} vote{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {dist.map((d, i) => {
          const pct = Math.round((d.count / total) * 100);
          return (
            <li
              key={d.label}
              style={{ animationDelay: `${i * 60}ms` }}
              className="flex animate-fade-up items-center gap-2 text-sm"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: colors[i] }}
              />
              <span className="w-12 shrink-0 font-semibold text-chalk">
                {d.label}
              </span>
              <span className="flex-1 text-right text-muted">
                {d.count} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
