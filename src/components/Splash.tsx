/**
 * Branded loading splash — the Klimb mark on pure black. Calm and quiet:
 * the tile eases in, then breathes gently. No text, no spinners.
 * Mirrors the pre-JS splash baked into index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <svg
        className="klimb-splash__mark"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Klimb"
      >
        {/* Black tile, hairline rim so it reads on pure black */}
        <rect x="4" y="4" width="112" height="112" rx="30" fill="#0d0d0e" />
        <rect
          x="4"
          y="4"
          width="112"
          height="112"
          rx="30"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1"
        />
        {/* Chiseled K */}
        <g fill="#f2efe8">
          <path d="M42 26 L54 18 L54 55 L42 67 Z" />
          <path d="M42 72 L54 60 L54 96 L42 104 Z" />
          <path d="M88 22 L100 22 L60 66 L51 57 Z" />
          <path d="M58 71 L67 62 L101 100 L88 100 Z" />
        </g>
      </svg>
    </div>
  );
}
