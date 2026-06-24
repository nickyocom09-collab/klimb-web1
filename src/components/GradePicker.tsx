import {
  gradeLabels,
  gradeOrdinals,
  type ClimbingType,
  type GradeSystem,
} from "../lib/grades";

export function GradePicker({
  value,
  onChange,
  climbingType = "boulder",
  system = "american",
}: {
  value: number | null;
  onChange: (g: number | null) => void;
  climbingType?: ClimbingType;
  system?: GradeSystem;
}) {
  const ordinals = gradeOrdinals(climbingType);
  const labels = gradeLabels(climbingType, system);
  return (
    <div className="grid grid-cols-6 gap-2">
      {ordinals.map((g) => {
        const selected = value === g;
        return (
          <button
            key={g}
            type="button"
            onClick={() => onChange(selected ? null : g)}
            className={`h-11 rounded-xl border text-sm font-bold transition ${
              selected
                ? "border-accent bg-accent text-bg"
                : "border-border bg-surface-2 text-muted hover:text-chalk"
            }`}
          >
            {labels[g]}
          </button>
        );
      })}
    </div>
  );
}
