/**
 * Branded loading splash — a geometric "K" logo draws itself onto a dark
 * tile, reaching for an orange climbing hold. No text, no spinners.
 * Mirrors the pre-JS splash baked into index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <div className="klimb-splash__glow" />
      <svg
        className="klimb-splash__mark"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Klimb"
      >
        <defs>
          {/* userSpaceOnUse: bounding-box gradients can't resolve on the
              zero-width vertical stroke of the K. */}
          <linearGradient
            id="klimb-kg"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="30"
            x2="0"
            y2="90"
          >
            <stop offset="0" stopColor="#8dffc0" />
            <stop offset="1" stopColor="#1fb862" />
          </linearGradient>
        </defs>
        <rect
          x="6"
          y="6"
          width="108"
          height="108"
          rx="30"
          fill="#141417"
          stroke="rgba(57,255,136,0.22)"
          strokeWidth="1.5"
        />
        <path
          className="klimb-splash__stroke"
          pathLength="100"
          d="M40 32 V88"
          stroke="url(#klimb-kg)"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          className="klimb-splash__stroke klimb-splash__stroke--2"
          pathLength="100"
          d="M78 34 L47 60 L80 88"
          stroke="url(#klimb-kg)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          className="klimb-splash__dot"
          cx="91"
          cy="34"
          r="6.5"
          fill="#FF9F45"
        />
      </svg>
    </div>
  );
}
