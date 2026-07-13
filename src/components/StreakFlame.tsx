/**
 * Custom animated streak flame — Duolingo-style. When the streak is alive the
 * flame flickers and glows; when it's out, it sits grey and still. No emoji.
 * Animations are CSS (see .klimb-flame in index.css) and respect reduced-motion.
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
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {active ? (
        <div
          className="klimb-flame-glow absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,150,40,0.55), transparent 65%)",
          }}
        />
      ) : null}
      <svg
        viewBox="0 0 48 64"
        className={active ? "klimb-flame relative" : "relative"}
        style={{ width: size, height: size }}
      >
        <defs>
          <linearGradient id="klimb-flame-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={active ? "#ffd24a" : "#3a3f3d"} />
            <stop offset="0.5" stopColor={active ? "#ff8a1e" : "#2c302e"} />
            <stop offset="1" stopColor={active ? "#f2500f" : "#242726"} />
          </linearGradient>
        </defs>
        <path
          d="M24 4 C 34 18 40 26 34 42 C 30 54 27 60 24 60 C 21 60 18 54 14 42 C 8 26 14 18 24 4 Z"
          fill="url(#klimb-flame-grad)"
        />
        {active ? (
          <path
            d="M24 26 C 29 33 30 38 27 45 C 25 50 25 53 24 53 C 23 53 21 49 20 45 C 18 39 20 33 24 26 Z"
            fill="#ffe98a"
          />
        ) : null}
      </svg>
    </div>
  );
}
