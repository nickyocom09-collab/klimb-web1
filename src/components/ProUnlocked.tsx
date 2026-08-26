import { Check, Crown, Sparkles } from "lucide-react";
import type { ProUnlockCelebration } from "../lib/entitlements";

const CELEBRATION_DOTS = [
  ["10%", "14%", "0s"],
  ["24%", "8%", "0.35s"],
  ["76%", "11%", "0.15s"],
  ["89%", "22%", "0.55s"],
  ["17%", "65%", "0.7s"],
  ["83%", "70%", "0.3s"],
] as const;

export function ProUnlocked({
  celebration,
  onStart,
}: {
  celebration: ProUnlockCelebration;
  onStart: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-unlocked-title"
      className="fixed inset-0 z-[120] grid place-items-center overflow-hidden bg-[#030806] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(57,255,136,0.24),transparent_30%),radial-gradient(circle_at_50%_95%,rgba(57,255,136,0.09),transparent_32%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[18%] h-72 w-72 -translate-x-1/2 rounded-full border border-accent/15 shadow-[0_0_0_42px_rgba(57,255,136,0.035),0_0_0_84px_rgba(57,255,136,0.018)]" />
      {CELEBRATION_DOTS.map(([left, top, delay]) => (
        <span
          key={`${left}-${top}`}
          aria-hidden="true"
          className="pointer-events-none absolute h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_14px_rgba(57,255,136,0.9)]"
          style={{ left, top, animationDelay: delay }}
        />
      ))}

      <section className="relative w-full max-w-sm animate-scale-in text-center">
        <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-[2rem] border border-accent/40 bg-accent/10 text-accent shadow-[0_0_70px_rgba(57,255,136,0.24)]">
          <Crown size={48} strokeWidth={2.2} />
          <span className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-accent text-bg shadow-lg">
            <Check size={20} strokeWidth={3.5} />
          </span>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-accent">
          <Sparkles size={14} /> Klimb Pro
        </p>
        <h1
          id="pro-unlocked-title"
          className="mt-3 text-5xl font-black leading-[0.92] tracking-[-0.055em] text-chalk"
        >
          Pro unlocked.
        </h1>
        <p className="mx-auto mt-5 max-w-xs text-base leading-relaxed text-muted">
          {celebration.isTrial
            ? "Your free week is active. Every Pro feature is ready right now."
            : "Your Apple purchase is verified. Every Pro feature is ready right now."}
        </p>

        <div className="mt-7 grid gap-2.5 rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4 text-left text-sm font-semibold text-chalk backdrop-blur">
          {["Full recap history", "Advanced climbing insights", "Custom logbook and video library"].map(
            (label) => (
              <div key={label} className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <Check size={15} strokeWidth={3} />
                </span>
                {label}
              </div>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-7 w-full rounded-2xl bg-accent py-4 text-base font-black text-bg shadow-[0_16px_45px_rgba(57,255,136,0.24)] transition active:scale-[0.985]"
        >
          Start Klimbing
        </button>
        <p className="mt-3 text-[11px] font-semibold text-faint">
          Pro access follows your verified Klimb account.
        </p>
      </section>
    </div>
  );
}
