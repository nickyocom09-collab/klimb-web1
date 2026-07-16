/**
 * Streak flame — GeoGuessr-style: a clean rounded fire with a warm gradient,
 * a hot core, and a real drop shadow (no glow ring). When the streak is out it
 * sits grey and still. Subtle flicker via CSS (.klimb-flame* in index.css),
 * respecting reduced-motion.
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
        viewBox="-20 -12 104 116"
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        className={active ? "klimb-flame relative" : "relative"}
        style={
          active
            ? { filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.45))" }
            : { opacity: 0.85 }
        }
      >
        <defs>
          <linearGradient id="klimb-fire-o" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={active ? "#ffd23f" : "#3d4240"} />
            <stop offset="0.35" stopColor={active ? "#ff8a1e" : "#333836"} />
            <stop offset="0.72" stopColor={active ? "#f5480d" : "#292d2b"} />
            <stop offset="1" stopColor={active ? "#d81e0a" : "#222624"} />
          </linearGradient>
          <linearGradient id="klimb-fire-i" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6cf" />
            <stop offset="0.55" stopColor="#ffd23f" />
            <stop offset="1" stopColor="#ff8a1e" />
          </linearGradient>
          <radialGradient id="klimb-fire-c" cx="50%" cy="72%" r="42%">
            <stop offset="0" stopColor="#fffef5" />
            <stop offset="1" stopColor="#ffd23f" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft cast shadow on the ground */}
        {active ? (
          <ellipse cx="32" cy="99" rx="20" ry="5" fill="#000" opacity="0.32" />
        ) : null}

        {/* Outer flame */}
        <path
          fill="url(#klimb-fire-o)"
          d="M32 2 C 30 20 18 26 18 44 C 18 40 22 37 25 36 C 20 48 20 54 20 60 C 20 78 30 96 44 96 C 58 96 62 80 62 66 C 62 54 56 42 48 34 C 49 39 48 43 46 46 C 48 30 40 14 32 2 Z"
        />

        {active ? (
          <>
            <path
              className="klimb-flame-inner"
              fill="url(#klimb-fire-i)"
              d="M34 40 C 32 52 26 58 26 68 C 26 82 33 90 40 90 C 49 90 52 78 52 68 C 52 58 46 50 40 46 C 41 50 40 53 39 55 C 40 48 37 43 34 40 Z"
            />
            <path
              className="klimb-flame-inner"
              fill="url(#klimb-fire-c)"
              d="M38 60 C 33 66 33 74 38 82 C 43 82 46 76 46 70 C 46 65 42 62 38 60 Z"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}
