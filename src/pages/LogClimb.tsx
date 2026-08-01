import { useNavigate } from "react-router-dom";
import { MapPinOff } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useLogClimb } from "../lib/useLogClimb";
import { AppHeader } from "../components/Layout";
import { Button } from "../components/ui";
import { LogScrollForm } from "../components/log/LogScrollForm";
import { LogStepFlow } from "../components/log/LogStepFlow";
import { RewardOverlay } from "../components/log/RewardOverlay";
import { PhotoSourceSheet } from "../components/PhotoSourceSheet";

/**
 * THE log flow — one screen, one save. You describe the climb (photo, color,
 * wall, type), say how it went (Flash / Sent / Project), and everything is
 * created together: the route, your grade, your rating, and either a send in
 * your logbook or a project with your first journal note.
 *
 * Two presentations, picked in Settings and stored on the profile:
 *  - "scroll": the classic single-screen form (default)
 *  - "steps":  a stepped, one-question-at-a-time flow
 * Both share all state and the single save path via useLogClimb().
 */
export function LogClimb() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const s = useLogClimb();

  if (!s.gymId && !s.offGrid) {
    return (
      <div>
        <AppHeader title="Log a Klimb" subtitle="Your gym" />
        <div className="flex flex-col items-center gap-4 px-8 py-20 text-center">
          <p className="text-faint">Pick a home gym to start logging climbs.</p>
          <Button onClick={() => navigate("/gym/select")}>Choose a gym</Button>
        </div>
      </div>
    );
  }

  const style = profile?.log_style ?? "steps";

  // The step flow is a fixed-height layout (pinned Back/Next), so it needs
  // h-full. The scroll form must be free to grow taller than the viewport so
  // the page scrolls all the way to the "Log it" button — h-full there clipped
  // the button off the bottom (the scroll glitch). min-h-full fixes it.
  return (
    <div className={`relative flex flex-col ${style === "steps" ? "h-full" : "min-h-full"}`}>
      <AppHeader
        title="Log a Klimb"
        subtitle={
          s.offGrid ? "Off-grid — personal logbook" : s.gymName ?? undefined
        }
        reserveSubtitle
      />
      {s.offGrid ? (
        <div className="px-5 pt-3">
          <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface p-3.5 text-sm text-muted animate-fade-in">
            <MapPinOff size={17} className="mt-0.5 shrink-0 text-accent" />
            <p>
              Logging off-grid — these save to your personal logbook and can be
              moved to{" "}
              <span className="font-semibold text-chalk">
                {s.offgridLabel || "your gym"}
              </span>{" "}
              later.
            </p>
          </div>
        </div>
      ) : null}
      {style === "steps" ? <LogStepFlow s={s} /> : <LogScrollForm s={s} />}
      <PhotoSourceSheet
        open={s.photoSourceOpen}
        onClose={() => s.setPhotoSourceOpen(false)}
        onChoose={(source) => void s.pickPhotoFrom(source)}
      />
      {s.reward ? <RewardOverlay reward={s.reward} /> : null}
    </div>
  );
}
