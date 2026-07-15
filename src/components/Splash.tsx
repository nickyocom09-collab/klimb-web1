/**
 * Branded loading splash — just the white Klimb "K" on the app's black
 * background. No app-icon square, no rounded edges. The mark eases in, then
 * breathes gently. No text, no spinners, no loading bar. Mirrors the pre-JS
 * splash in index.html for a seamless handoff.
 */
import { KMark } from "./KMark";

export function Splash() {
  return (
    <div className="klimb-splash">
      <KMark className="klimb-splash__mark" />
    </div>
  );
}
