/**
 * Streak fire — image-based flame. Lit (streak > 0) shows the orange flame
 * with a living flicker and a breathing warm glow; dead (streak === 0) shows
 * the burned-out grey flame, still, with a faint smoke wisp. All animation is
 * transform/opacity only and freezes under prefers-reduced-motion.
 */
export function StreakFire({
  streak,
  size = 64,
}: {
  streak: number;
  size?: number;
}) {
  const lit = streak > 0;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <style>{STREAK_FIRE_CSS}</style>
      {lit ? (
        <>
          <div
            className="klimb-fire-glow"
            style={{
              position: "absolute",
              inset: "8%",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 50% 62%, rgba(255,140,30,0.55), rgba(255,90,10,0.22) 55%, transparent 75%)",
              filter: `blur(${Math.max(6, size * 0.12)}px)`,
            }}
          />
          <img
            src="/streak-fire.png"
            alt=""
            draggable={false}
            className="klimb-fire-flicker"
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transformOrigin: "bottom center",
            }}
          />
        </>
      ) : (
        <>
          <img
            src="/streak-fire-dead.png"
            alt=""
            draggable={false}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: 0.85,
            }}
          />
          <div
            className="klimb-fire-smoke"
            style={{
              position: "absolute",
              left: "50%",
              top: "12%",
              width: Math.max(4, size * 0.07),
              height: Math.max(10, size * 0.22),
              borderRadius: 999,
              background:
                "linear-gradient(to top, rgba(150,155,152,0.35), transparent)",
              filter: "blur(2px)",
            }}
          />
        </>
      )}
    </div>
  );
}

const STREAK_FIRE_CSS = `
@keyframes klimb-fire-flicker {
  0%, 100% { transform: scaleX(1) scaleY(1) rotate(0deg); }
  20%      { transform: scaleX(0.975) scaleY(1.035) rotate(-0.8deg); }
  40%      { transform: scaleX(1.02) scaleY(0.975) rotate(0.6deg); }
  60%      { transform: scaleX(0.985) scaleY(1.02) rotate(0.9deg); }
  80%      { transform: scaleX(1.01) scaleY(0.99) rotate(-0.5deg); }
}
.klimb-fire-flicker {
  animation: klimb-fire-flicker 1.1s ease-in-out infinite;
  will-change: transform;
}
@keyframes klimb-fire-glow-breathe {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.08); }
}
.klimb-fire-glow {
  animation: klimb-fire-glow-breathe 1.6s ease-in-out infinite;
  will-change: transform, opacity;
}
@keyframes klimb-fire-smoke-drift {
  0%   { opacity: 0; transform: translate(-50%, 30%) scaleY(0.6); }
  30%  { opacity: 0.7; }
  100% { opacity: 0; transform: translate(-40%, -90%) scaleY(1.3); }
}
.klimb-fire-smoke {
  animation: klimb-fire-smoke-drift 3.2s ease-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .klimb-fire-flicker, .klimb-fire-glow, .klimb-fire-smoke {
    animation: none;
  }
  .klimb-fire-smoke { opacity: 0.35; }
}
`;
