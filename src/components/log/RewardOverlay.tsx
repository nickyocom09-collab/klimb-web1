import { Bookmark, Check, Flag, Zap } from "lucide-react";
import { REWARD, type Outcome } from "../../lib/useLogClimb";

/** The celebratory flash that fires on a successful log — shared by both the
 *  single-screen form and the stepped flow. */
export function RewardOverlay({ reward }: { reward: Outcome }) {
  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-app animate-fade-in flex-col items-center justify-center gap-3 bg-bg/95 backdrop-blur-sm">
      <span className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-accent/25 animate-pulse-ring" />
        <span className="flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-accent text-bg shadow-glow">
          {reward === "flash" ? (
            <Zap size={30} strokeWidth={2.5} />
          ) : reward === "project" ? (
            <Bookmark size={28} strokeWidth={2.5} />
          ) : reward === "topped" ? (
            <Flag size={28} strokeWidth={2.5} />
          ) : (
            <Check size={32} strokeWidth={3} />
          )}
        </span>
      </span>
      <p className="animate-fade-up text-2xl font-extrabold text-chalk [animation-delay:120ms]">
        {REWARD[reward].title}
      </p>
      <p className="animate-fade-up text-sm text-muted [animation-delay:200ms]">
        {REWARD[reward].sub}
      </p>
    </div>
  );
}
