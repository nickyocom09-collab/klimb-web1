/**
 * Branded loading splash — the Klimb logo on pure black. Calm and quiet:
 * the mark eases in, then breathes gently. No text, no spinners.
 * Mirrors the pre-JS splash baked into index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <img
        className="klimb-splash__mark"
        src="/klimb.logo-removebg-preview.png"
        alt="Klimb"
      />
    </div>
  );
}
