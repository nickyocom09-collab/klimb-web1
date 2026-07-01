import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/** Slick, borderless pill dropdown. Closes on outside-click or Escape. */
export function Dropdown({
  value,
  options,
  onChange,
  label,
  align = "left",
  className = "",
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  /** Optional prefix shown before the value, e.g. "Wall". */
  label?: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold text-chalk transition active:scale-[0.97]"
      >
        {label ? <span className="text-muted">{label}</span> : null}
        {value}
        <ChevronDown
          size={16}
          className={`text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? (
        <div
          className={`absolute top-full z-40 mt-2 max-h-72 w-52 origin-top animate-scale-in overflow-y-auto rounded-2xl border border-border bg-surface p-1 shadow-card ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((opt) => {
            const on = opt === value;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  on
                    ? "bg-surface-2 font-semibold text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-chalk"
                }`}
              >
                {opt}
                {on ? <Check size={16} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
