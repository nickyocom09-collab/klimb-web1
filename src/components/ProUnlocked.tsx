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

const PRO_UNLOCKED_FEATURES = [
  {
    title: "Weekly recap history",
    description: "Look back on every week you have climbed.",
  },
  {
    title: "Monthly recap history",
    description: "See how your climbing changes month by month.",
  },
  {
    title: "Yearly recap history",
    description: "Keep the big picture of every year in your logbook.",
  },
  {
    title: "Progress ranges",
    description: "Follow the grades where your climbing is growing.",
  },
  {
    title: "Flash rate",
    description: "See how often you finish a climb on your first try.",
  },
  {
    title: "Attempts per send",
    description: "Understand how much work goes into each send.",
  },
  {
    title: "Personal records",
    description: "Celebrate your strongest performances over time.",
  },
  {
    title: "Deeper gym insights",
    description: "Learn more from the sessions in each gym you visit.",
  },
  {
    title: "Your custom logbook",
    description: "Choose the questions and details that matter to you.",
  },
  {
    title: "Video attachments",
    description: "Save a climbing video directly with its Klimb.",
  },
  {
    title: "Your video library",
    description: "Keep every saved climbing video in one private place.",
  },
  {
    title: "Every new Pro insight",
    description: "New Pro tools unlock automatically as they are released.",
  },
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
      className="fixed inset-0 z-[120] overflow-hidden bg-[#020806] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(57,255,136,0.18),transparent_30%),radial-gradient(circle_at_50%_88%,rgba(57,255,136,0.08),transparent_34%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[-8rem] h-96 w-96 -translate-x-1/2 rounded-full bg-accent/[0.035] blur-3xl" />
      {CELEBRATION_DOTS.map(([left, top, delay]) => (
        <span
          key={`${left}-${top}`}
          aria-hidden="true"
          className="pointer-events-none absolute h-1.5 w-1.5 animate-pulse rounded-full bg-accent/80 shadow-[0_0_14px_rgba(57,255,136,0.75)]"
          style={{ left, top, animationDelay: delay }}
        />
      ))}

      <section className="relative mx-auto flex h-full min-h-0 w-full max-w-sm animate-scale-in flex-col">
        <header className="shrink-0 text-center">
          <div className="mx-auto grid h-[clamp(4.25rem,10vh,5.5rem)] w-[clamp(4.25rem,10vh,5.5rem)] place-items-center rounded-[1.6rem] border border-accent/35 bg-accent/[0.09] text-accent shadow-[0_0_55px_rgba(57,255,136,0.2)]">
            <Crown className="h-11 w-11" strokeWidth={2.15} />
          </div>

          <div className="mt-[clamp(0.65rem,1.7vh,1rem)] flex items-center justify-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-bg">
              <Check size={13} strokeWidth={3.5} />
            </span>
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.25em] text-accent">
              <Sparkles size={13} /> Klimb Pro active
            </p>
          </div>

          <h1
            id="pro-unlocked-title"
            className="mt-[clamp(0.45rem,1.2vh,0.75rem)] text-[clamp(2.65rem,6.2vh,3.75rem)] font-black leading-[0.94] tracking-[-0.055em] text-chalk"
          >
            Pro unlocked.
          </h1>
          <p className="mx-auto mt-[clamp(0.65rem,1.7vh,1rem)] max-w-[20rem] text-[clamp(0.85rem,1.85vh,1rem)] leading-[1.5] text-[#a8b1ac]">
            {celebration.isTrial
              ? "Your free week is active. Every Pro feature is ready now."
              : "Your Apple purchase is verified. Every Pro feature is ready now."}
          </p>
        </header>

        <section
          aria-labelledby="everything-unlocked-title"
          className="mt-[clamp(0.85rem,2vh,1.25rem)] flex min-h-[10.5rem] flex-1 flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0b120e]/95 text-left shadow-[0_20px_55px_rgba(0,0,0,0.28)] backdrop-blur"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
            <div>
              <h2
                id="everything-unlocked-title"
                className="text-sm font-black text-chalk"
              >
                Explore what is unlocked
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold text-faint">
                Scroll through everything ready for you now.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-accent">
              Ready now
            </span>
          </div>

          <ul className="min-h-0 flex-1 snap-y snap-proximity overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PRO_UNLOCKED_FEATURES.map(({ title, description }) => (
              <li
                key={title}
                className="mb-2 flex min-h-[4.5rem] snap-start items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 last:mb-0"
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <Check size={15} strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-5 text-chalk">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                    {description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="shrink-0 pt-[clamp(0.85rem,2vh,1.25rem)] text-center">
          <button
            type="button"
            onClick={onStart}
            className="w-full rounded-2xl bg-accent py-4 text-base font-black text-bg shadow-[0_14px_42px_rgba(57,255,136,0.22)] transition active:scale-[0.985]"
          >
            Start Klimbing
          </button>
          <p className="mt-2.5 text-[11px] font-semibold leading-4 text-faint">
            Pro access follows your verified Klimb account.
          </p>
        </footer>
      </section>
    </div>
  );
}
