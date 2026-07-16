/**
 * Branded loading splash — the white Klimb "K" mark fades in cleanly on the
 * app's dark background, with a small spaced tagline beneath it. Smooth and
 * minimal, no bounce. Mirrors the pre-JS splash in index.html.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <div className="klimb-splash__group">
        <img className="klimb-splash__mark" src="/klimb-k-white.png" alt="Klimb" />
        <p className="klimb-splash__tag">Log every climb</p>
      </div>
    </div>
  );
}
