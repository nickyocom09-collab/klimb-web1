/**
 * Klimb's streak mascot — a little climbing monkey. When your streak is alive
 * he's bright-eyed, wears his green band, and bobs happily; when it lapses he
 * slumps, greys out, droops his eyes, and dozes off (Duolingo-style).
 * Animations are CSS (see .klimb-monkey in index.css) and respect
 * prefers-reduced-motion.
 */
export function StreakMonkey({
  weeks,
  size = 84,
}: {
  weeks: number;
  size?: number;
}) {
  const happy = weeks > 0;
  const fur = happy ? "#8a5a3b" : "#726b62";
  const furDark = happy ? "#6f4630" : "#5c564e";
  const face = happy ? "#d79b6f" : "#a79f95";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      {happy ? (
        <div
          className="klimb-monkey-glow absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(57,255,136,0.32), transparent 66%)",
          }}
        />
      ) : null}
      <svg
        viewBox="0 0 100 100"
        className={happy ? "klimb-monkey relative" : "relative"}
        style={{ width: size, height: size }}
      >
        {/* Ears */}
        <circle cx="23" cy="37" r="13" fill={fur} />
        <circle cx="77" cy="37" r="13" fill={fur} />
        <circle cx="23" cy="37" r="7" fill={face} />
        <circle cx="77" cy="37" r="7" fill={face} />

        {/* Head + face patch */}
        <circle cx="50" cy="53" r="30" fill={fur} />
        <ellipse cx="50" cy="59" rx="21" ry="22" fill={face} />

        {/* Green climber's headband */}
        <path
          d="M21 44 Q50 33 79 44 L79 50 Q50 40 21 50 Z"
          fill={happy ? "rgb(57 255 136)" : "#3f4a44"}
        />
        <path
          d="M75 46 l9 -3 -2 5 6 1 -8 4 z"
          fill={happy ? "rgb(57 255 136)" : "#3f4a44"}
        />

        {happy ? (
          <>
            {/* Bright open eyes */}
            <ellipse cx="42" cy="55" rx="5" ry="6.2" fill="#fff" />
            <ellipse cx="58" cy="55" rx="5" ry="6.2" fill="#fff" />
            <circle cx="42.6" cy="56" r="2.8" fill="#1a120c" />
            <circle cx="58.6" cy="56" r="2.8" fill="#1a120c" />
            <circle cx="41.6" cy="54.6" r="1" fill="#fff" />
            <circle cx="57.6" cy="54.6" r="1" fill="#fff" />
            {/* Cheeks */}
            <circle cx="35" cy="64" r="3.4" fill="rgba(255,120,120,0.5)" />
            <circle cx="65" cy="64" r="3.4" fill="rgba(255,120,120,0.5)" />
            {/* Big smile */}
            <path
              d="M41 66 Q50 76 59 66"
              fill="none"
              stroke={furDark}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            {/* Droopy closed eyes */}
            <path
              d="M37 55 Q42 59 47 55"
              fill="none"
              stroke={furDark}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M53 55 Q58 59 63 55"
              fill="none"
              stroke={furDark}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Tired little frown */}
            <path
              d="M43 71 Q50 67 57 71"
              fill="none"
              stroke={furDark}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Dozing zzz */}
            <text
              x="80"
              y="26"
              fontSize="11"
              fontWeight="800"
              fill="#8b8378"
              fontFamily="sans-serif"
            >
              z
            </text>
            <text
              x="86"
              y="17"
              fontSize="8"
              fontWeight="800"
              fill="#8b8378"
              fontFamily="sans-serif"
            >
              z
            </text>
          </>
        )}

        {/* Nostrils */}
        <circle cx="46" cy="62" r="1.4" fill={furDark} />
        <circle cx="54" cy="62" r="1.4" fill={furDark} />
      </svg>
    </div>
  );
}
