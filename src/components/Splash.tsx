/**
 * Branded loading splash — the Klimb logo on pure black. Calm and quiet:
 * the mark eases in, then breathes gently. No text, no spinners.
 * Mirrors the pre-JS splash baked into index.html for a seamless handoff.
 */
import { KMark } from "./KMark";

export function Splash() {
  return (
    <div className="klimb-splash">
      <div className="klimb-splash__stage">
        <span className="klimb-splash__glow" aria-hidden="true" />
        {/* Just the K mark — no app-icon square. Cream on black. */}
        <KMark className="klimb-splash__mark" />
      </div>
    </div>
  );
}
