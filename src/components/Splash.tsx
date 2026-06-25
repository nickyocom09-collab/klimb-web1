/**
 * Branded loading splash — "Klimb" wordmark over an animated gradient.
 * Shown while auth/profile is resolving so the app never flashes blank.
 * Mirrors the pre-JS splash baked into index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <div className="klimb-splash__glow" />
      <h1 className="klimb-splash__word">Klimb</h1>
      <div className="klimb-splash__dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
