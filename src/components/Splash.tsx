/**
 * Branded loading splash — the Klimb mark: a gradient K drawing itself onto a
 * faceted climbing-wall tile, reaching for an orange hold, with a route of
 * holds trailing down and chalk dust below. No text, no spinners.
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
          <linearGradient
            id="klimb-tile"
            gradientUnits="userSpaceOnUse"
            x1="60"
            y1="5"
            x2="60"
            y2="115"
          >
            <stop offset="0" stopColor="#1c2023" />
            <stop offset="0.55" stopColor="#101215" />
            <stop offset="1" stopColor="#0a0c0e" />
          </linearGradient>
          <linearGradient
            id="klimb-rim"
            gradientUnits="userSpaceOnUse"
            x1="60"
            y1="5"
            x2="60"
            y2="115"
          >
            <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="0.4" stopColor="rgba(57,255,136,0.10)" />
            <stop offset="1" stopColor="rgba(57,255,136,0.28)" />
          </linearGradient>
          {/* userSpaceOnUse: bounding-box gradients can't resolve on the
              zero-width vertical stroke of the K. */}
          <linearGradient
            id="klimb-kg"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="28"
            x2="0"
            y2="92"
          >
            <stop offset="0" stopColor="#c2ffdd" />
            <stop offset="0.45" stopColor="#4fe98d" />
            <stop offset="1" stopColor="#16a557" />
          </linearGradient>
          <clipPath id="klimb-clip">
            <rect x="5" y="5" width="110" height="110" rx="30" />
          </clipPath>
        </defs>

        <rect x="5" y="5" width="110" height="110" rx="30" fill="url(#klimb-tile)" />
        {/* Faceted gym-wall panels behind the K */}
        <g clipPath="url(#klimb-clip)">
          <path
            d="M5 92 L64 34 L115 70 L115 115 L5 115 Z"
            fill="rgba(57,255,136,0.05)"
          />
          <path
            d="M5 115 L48 62 L115 104 L115 115 Z"
            fill="rgba(255,255,255,0.035)"
          />
        </g>
        <rect
          x="5"
          y="5"
          width="110"
          height="110"
          rx="30"
          stroke="url(#klimb-rim)"
          strokeWidth="1.5"
        />

        {/* K shadow, then the K draws itself in */}
        <g opacity="0.4">
          <path
            d="M42 35 V89"
            stroke="#000"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M79 37 L50 61.5 L81 89"
            stroke="#000"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <path
          className="klimb-splash__stroke"
          pathLength="100"
          d="M42 33 V87"
          stroke="url(#klimb-kg)"
          strokeWidth="13.5"
          strokeLinecap="round"
        />
        <path
          className="klimb-splash__stroke klimb-splash__stroke--2"
          pathLength="100"
          d="M79 35 L50 59.5 L81 87"
          stroke="url(#klimb-kg)"
          strokeWidth="13.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* The hold it's reaching for */}
        <circle className="klimb-splash__dot" cx="92" cy="33" r="7" fill="#FF9F45" />
        <circle
          className="klimb-splash__dot"
          cx="89.6"
          cy="30.6"
          r="2.1"
          fill="rgba(255,255,255,0.55)"
        />

        {/* Route holds trailing down the wall + chalk dust */}
        <g className="klimb-splash__extras">
          <circle cx="101.5" cy="46" r="3.2" fill="#14B8A6" opacity="0.9" />
          <circle cx="106" cy="58.5" r="2.4" fill="#EC4899" opacity="0.85" />
          <circle cx="22" cy="97" r="1.8" fill="rgba(255,255,255,0.14)" />
          <circle cx="29" cy="103" r="1.3" fill="rgba(255,255,255,0.10)" />
          <circle cx="25" cy="90" r="1.1" fill="rgba(255,255,255,0.08)" />
        </g>
      </svg>
    </div>
  );
}
