import { Globe as GlobeIcon } from "lucide-react";
import { AppHeader } from "../components/Layout";

export function Globe() {
  return (
    <div>
      <AppHeader title="Globe" />
      <div className="flex animate-fade-up flex-col items-center justify-center gap-5 px-8 py-24 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-accent/30 animate-pulse-ring" />
          <span className="absolute inset-0 rounded-full bg-accent/20 animate-pulse-ring [animation-delay:1.2s]" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-surface-2 shadow-glow">
            <GlobeIcon size={36} className="text-accent" />
          </div>
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent">
          Coming soon
        </span>
        <h2 className="text-2xl font-extrabold tracking-tight text-chalk">
          Climb the whole map
        </h2>
        <p className="max-w-xs text-sm text-muted">
          A world map of climbing gyms is on the way. Find gyms near you and
          explore routes wherever you travel.
        </p>
      </div>
    </div>
  );
}
