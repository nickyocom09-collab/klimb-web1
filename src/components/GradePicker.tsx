import {
  pickerOptions,
  type ClimbingType,
  type GradeStyle,
  type GradeSystem,
} from "../lib/grades";

export function GradePicker({
  value,
  onChange,
  climbingType = "boulder",
  system = "american",
  gradeStyle = "classic",
  options: customOptions,
}: {
  value: number | null;
  onChange: (g: number | null) => void;
  climbingType?: ClimbingType;
  system?: GradeSystem;
  /** The gym's house style — 'bands' renders Bentonville-style options. */
  gradeStyle?: GradeStyle;
  /** Override the option set (e.g. top-rope gym +/- grades). */
  options?: { value: number; label: string }[];
}) {
  const options = customOptions ?? pickerOptions(climbingType, system, gradeStyle);
  // Bentonville boulder bands are only 4 wide — give them room to breathe.
  const cols =
    gradeStyle === "bands" && climbingType === "boulder"
      ? "grid-cols-4"
      : "grid-cols-6";
  return (
    <div className={`grid ${cols} gap-2`}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(selected ? null : o.value)}
            className={`h-11 rounded-xl border text-sm font-bold transition ${
              selected
                ? "border-accent bg-accent text-bg"
                : "border-border bg-surface-2 text-muted hover:text-chalk"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
