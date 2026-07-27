import {
  pickerOptions,
  type ClimbingType,
  type GradeStyle,
  type GradeSystem,
} from "../lib/grades";
import { ChevronDown } from "lucide-react";

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
  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
        aria-label="Select grade"
        className={`klimb-grade h-12 w-full appearance-none rounded-2xl border bg-surface-2 px-4 pr-11 text-base font-bold outline-none transition focus:border-accent ${
          selected ? "border-accent/60 text-accent" : "border-border text-muted"
        }`}
      >
        <option value="">Not set</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        size={18}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  );
}
