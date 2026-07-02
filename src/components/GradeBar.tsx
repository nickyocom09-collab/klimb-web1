import {
  distributionBuckets,
  spreadColor,
  type ClimbingType,
  type GradeStyle,
  type GradeSystem,
} from "../lib/grades";

/** Horizontal, color-coded distribution bar. Tight spread = green, wide = orange. */
export function GradeBar({
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
  const dist = distributionBuckets(grades, climbingType, system, gradeStyle);
  if (dist.length === 0) {
    return <p className="text-sm text-faint">No grades yet — be the first.</p>;
  }
  const max = Math.max(...dist.map((d) => d.count));
  const color = spreadColor(grades);

  return (
    <div className="flex flex-col gap-2">
      {dist.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-right text-xs font-semibold text-muted">
            {d.label}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${max > 0 ? (d.count / max) * 100 : 0}%`,
                backgroundColor: d.count > 0 ? color : "transparent",
                minWidth: d.count > 0 ? "0.5rem" : 0,
              }}
            />
          </div>
          <span className="w-5 shrink-0 text-xs text-faint">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
