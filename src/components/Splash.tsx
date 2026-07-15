/**
 * Branded loading splash — the exact white Klimb "K" (no app-icon square, no
 * rounded edges) on the app's black background. Eases in, then breathes
 * gently. No text, no spinners, no loading bar. Mirrors the pre-JS splash in
 * index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <img className="klimb-splash__mark" src="/klimb-k-white.png" alt="Klimb" />
    </div>
  );
}
