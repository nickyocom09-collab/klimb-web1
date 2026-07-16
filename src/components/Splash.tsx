/**
 * Branded loading splash — a small white Klimb "K" centered on a flat dark
 * background, with a single very smooth fade-in. Mirrors the pre-JS splash in
 * index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <img className="klimb-splash__mark" src="/klimb-k-white.png" alt="Klimb" />
    </div>
  );
}
