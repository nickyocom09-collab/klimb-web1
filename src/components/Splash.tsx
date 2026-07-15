/**
 * Branded loading splash — the exact Klimb app icon on pure black. Calm and
 * quiet: the mark eases in, then breathes gently. No text, no spinners, no
 * loading bar. Mirrors the pre-JS splash in index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <img
        className="klimb-splash__mark"
        src="/klimb-loading.png"
        alt="Klimb"
      />
    </div>
  );
}
