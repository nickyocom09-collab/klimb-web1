import {
  communityGrade,
  distributionBuckets,
  formatGradeStyled,
  type ClimbingType,
  type GradeStyle,
  type GradeSystem,
} from "../lib/grades";

/** SVG path for a filled pie slice from startFrac to endFrac (0..1 of a turn). */
function slicePath(
  cx: number,
  cy: number,
  r: number,
  startFrac: number,
  endFrac: number,
): string {
  // Start at 12 o'clock and sweep clockwise.
  const a0 = startFrac * 2 * Math.PI - Math.PI / 2;
  const a1 = endFrac * 2 * Math.PI - Math.PI / 2;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const largeArc = endFrac - startFrac > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

/**
 * Filled pie chart of how the community voted on a route's grade. Each
 * distinct grade is a slice; the community verdict sits above the chart so
 * text never overlaps the graphic. Colors ramp green→amber.
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

  const R = 62;
  const colors = dist.map((_, i) =>
    dist.length === 1
      ? "hsl(146 72% 52%)"
      : `hsl(${146 - (i / (dist.length - 1)) * 110} 72% 54%)`,
  );

  let acc = 0;
  const slices = dist.map((d, i) => {
    const start = acc / total;
    acc += d.count;
    const end = acc / total;
    // A single 100% slice can't be drawn as an arc — use a full circle.
    if (dist.length === 1) {
      return <circle key={d.label} cx="70" cy="70" r={R} fill={colors[i]} />;
    }
    return (
      <path
        key={d.label}
        d={slicePath(70, 70, R, start, end)}
        fill={colors[i]}
        stroke="rgb(var(--c-surface))"
        strokeWidth={2}
      />
    );
  });

  return (
    <div>
      {/* Verdict header — kept out of the chart so nothing overlaps. */}
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-4xl font-extrabold leading-none text-accent">
          {formatGradeStyled(community, climbingType, system, gradeStyle)}
        </p>
        <p className="text-xs uppercase tracking-wide text-muted">
          community · {total} vote{total === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex items-center gap-5">
        <div className="h-36 w-36 shrink-0 animate-scale-in">
          <svg viewBox="0 0 140 140" className="h-full w-full">
            {slices}
          </svg>
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
                <span className="w-14 shrink-0 font-semibold text-chalk">
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
    </div>
  );
}
