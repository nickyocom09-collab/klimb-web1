import { Crown } from "lucide-react";

/** Small, consistent status mark for every surface that shows an account. */
export function ProBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-label="Klimb Pro account"
      title="Klimb Pro"
      className={`inline-flex shrink-0 items-center rounded-full border border-accent/25 bg-accent/10 font-black uppercase tracking-[0.12em] text-accent ${
        compact ? "h-4 gap-0.5 px-1 text-[7px]" : "h-5 gap-1 px-1.5 text-[8px]"
      }`}
    >
      <Crown aria-hidden="true" size={compact ? 8 : 10} strokeWidth={2.8} />
      Pro
    </span>
  );
}
