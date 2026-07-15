/**
 * Custom animated streak flame — a layered, flickering fire with a soft glow.
 * Padded viewBox so nothing clips. When the streak is out it sits grey and
 * still. Animations are CSS (see .klimb-flame* in index.css) and respect
 * reduced-motion.
 */
export function StreakFlame({
  weeks,
  size = 64,
}: {
  weeks: number;
  size?: number;
}) {
  const active = weeks > 0;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="-14 -10 92 106"
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        className={active ? "klimb-flame relative" : "relative"}
      >
        <defs>
          <radialGradient id="klimb-fire-glow" cx="50%" cy="62%" r="55%">
            <stop offset="0" stopColor="#ff7a12" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff7a12" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="klimb-fire-outer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={active ? "#ffcf3a" : "#3a3f3d"} />
            <stop offset="0.4" stopColor={active ? "#ff7d15" : "#2f3331"} />
            <stop offset="1" stopColor={active ? "#e02914" : "#262a28"} />
          </linearGradient>
          <linearGradient id="klimb-fire-inner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1b8" />
            <stop offset="1" stopColor="#ffab24" />
          </linearGradient>
        </defs>

        {active ? (
          <ellipse cx="32" cy="52" rx="42" ry="46" fill="url(#klimb-fire-glow)" />
        ) : null}

        {/* Outer flame: body + side licks + a curl */}
        <path
          fill="url(#klimb-fire-outer)"
          d="M32 90 C 14 84 6 68 14 50 C 17 55 21 57 24 58 C 18 45 22 30 33 20 C 31 27 33 33 37 37 C 40 28 39 18 46 8 C 47 20 52 26 55 34 C 57 30 59 26 59 21 C 65 32 66 52 52 74 C 47 82 40 88 32 90 Z"
        />

        {active ? (
          <>
            <path
              className="klimb-flame-inner"
              fill="url(#klimb-fire-inner)"
              d="M32 84 C 22 79 17 66 24 51 C 26 56 29 57 31 58 C 27 47 30 34 39 27 C 38 36 41 42 41 49 C 44 44 45 40 45 35 C 50 46 49 62 40 76 C 37 80 35 83 32 84 Z"
            />
            <path
              className="klimb-flame-inner"
              fill="#fff6d8"
              d="M32 80 C 26 76 25 66 31 57 C 34 63 36 66 36 71 C 36 76 34 80 32 80 Z"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}
