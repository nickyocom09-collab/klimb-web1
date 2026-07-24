import { Mountain, Cable } from "lucide-react";
import { isRopeType, type ClimbType } from "../../lib/constants";
import { SlideTabs } from "../ui";

/**
 * Two umbrellas: Boulder (no rope) and Rope. Picking Rope reveals a
 * Top Rope / Lead sub-choice. Shared by both log flows so the split behaves
 * identically everywhere.
 */
export function ClimbTypePicker({
  value,
  onChange,
}: {
  value: ClimbType;
  onChange: (t: ClimbType) => void;
}) {
  const rope = isRopeType(value);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Umbrella
          active={!rope}
          icon={Mountain}
          label="Boulder"
          sub="No rope"
          onClick={() => onChange("boulder")}
        />
        <Umbrella
          active={rope}
          icon={Cable}
          label="Rope"
          sub="Top rope or lead"
          // Default a fresh rope pick to top rope; keep the current rope
          // sub-choice if we're already on one.
          onClick={() => onChange(rope ? value : "toprope")}
        />
      </div>

      {rope ? (
        <SlideTabs
          value={value === "lead" ? "lead" : "toprope"}
          onChange={(v) => onChange(v)}
          options={[
            { value: "toprope", label: "Top Rope" },
            { value: "lead", label: "Lead" },
          ]}
        />
      ) : null}
    </div>
  );
}

function Umbrella({
  active,
  icon: Icon,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  icon: typeof Mountain;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-4 text-center transition ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-surface-2 text-muted hover:text-chalk"
      }`}
    >
      <Icon size={24} />
      <span className="text-sm font-bold leading-none">{label}</span>
      <span className="text-[10px] leading-none text-faint">{sub}</span>
    </button>
  );
}
