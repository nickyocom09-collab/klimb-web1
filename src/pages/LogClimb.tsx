import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useLogClimb } from "../lib/useLogClimb";
import { AppHeader } from "../components/Layout";
import { Button } from "../components/ui";
import { LogScrollForm } from "../components/log/LogScrollForm";
import { LogStepFlow } from "../components/log/LogStepFlow";
import { RewardOverlay } from "../components/log/RewardOverlay";

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

  if (!s.gymId) {
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
      <AppHeader title="Log a Klimb" subtitle={s.gymName ?? undefined} />
      {style === "steps" ? <LogStepFlow s={s} /> : <LogScrollForm s={s} />}
      {s.reward ? <RewardOverlay reward={s.reward} /> : null}
    </div>
  );
}
