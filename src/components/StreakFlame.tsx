/**
 * Custom animated streak flame. When the streak is alive it's a layered,
 * flickering fire (orange body, hot yellow core) with a soft flame-shaped
 * glow — no circle behind it. When it's out, it sits grey and still.
 * Animations are CSS (see .klimb-flame* in index.css) and respect
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
        viewBox="0 0 64 80"
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        className={active ? "klimb-flame relative" : "relative"}
        style={
          active
            ? { filter: "drop-shadow(0 2px 10px rgba(255,110,20,0.55))" }
            : undefined
        }
      >
        <defs>
          <linearGradient id="klimb-fire-outer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={active ? "#ffb018" : "#3a3f3d"} />
            <stop offset="0.45" stopColor={active ? "#ff7a12" : "#2f3331"} />
            <stop offset="1" stopColor={active ? "#e8380d" : "#262a28"} />
          </linearGradient>
          <linearGradient id="klimb-fire-inner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe680" />
            <stop offset="1" stopColor="#ffab24" />
          </linearGradient>
        </defs>

        {/* Outer flame with side licks */}
        <path
          fill="url(#klimb-fire-outer)"
          d="M32 76 C 16 70 10 56 18 42 C 20 47 23 49 25 50 C 21 39 24 24 38 14 C 35 24 41 28 42 38 C 44 34 47 31 46 26 C 53 36 54 54 44 66 C 40 71 37 74 32 76 Z"
        />

        {active ? (
          <>
            {/* Inner flame — flickers a touch faster than the body */}
            <path
              className="klimb-flame-inner"
              fill="url(#klimb-fire-inner)"
              d="M32 70 C 23 66 20 56 26 46 C 27 50 29 51 31 52 C 29 43 32 33 39 27 C 38 35 41 40 40 47 C 42 52 39 64 32 70 Z"
            />
            {/* Hot core */}
            <path
              className="klimb-flame-inner"
              fill="#fff4cf"
              d="M32 66 C 27 63 26 56 30 50 C 32 54 34 56 34 60 C 34 64 33 66 32 66 Z"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}
