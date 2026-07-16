/**
 * Branded loading splash — the white Klimb "K" on a soft neutral-dark radial
 * glow. A single, very smooth fade-in (no bounce, no motion). Mirrors the
 * pre-JS splash in index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <img className="klimb-splash__mark" src="/klimb-k-white.png" alt="Klimb" />
    </div>
  );
}
