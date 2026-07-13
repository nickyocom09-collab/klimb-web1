/**
 * Branded loading splash — the Klimb logo on pure black. Calm and quiet:
 * the mark eases in, then breathes gently. No text, no spinners.
 * Mirrors the pre-JS splash baked into index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <div className="klimb-splash__stage">
        <span className="klimb-splash__glow" aria-hidden="true" />
        <img
          className="klimb-splash__mark"
          src="/klimb.logo-removebg-preview.png"
          alt="Klimb"
        />
      </div>
      <span className="klimb-splash__bar" aria-hidden="true">
        <span className="klimb-splash__bar-fill" />
      </span>
    </div>
  );
}
