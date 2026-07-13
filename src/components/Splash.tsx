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
        {/* Just the K mark — no app-icon square. Cream on black. */}
        <svg
          className="klimb-splash__mark"
          viewBox="27 16 88 88"
          fill="#f2efe8"
          role="img"
          aria-label="Klimb"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M42 26 L54 18 L54 55 L42 67 Z" />
          <path d="M42 72 L54 60 L54 96 L42 104 Z" />
          <path d="M88 22 L100 22 L60 66 L51 57 Z" />
          <path d="M58 71 L67 62 L101 100 L88 100 Z" />
        </svg>
      </div>
      <span className="klimb-splash__bar" aria-hidden="true">
        <span className="klimb-splash__bar-fill" />
      </span>
    </div>
  );
}
