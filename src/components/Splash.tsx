/**
 * Branded loading splash — the exact white Klimb "K" mark pops in, then the
 * rest of the wordmark (L-I-M-B) slides out of it to spell KLIMB, Netflix
 * style. Sits on a soft green-tinted gradient that fades to black.
 */
export function Splash() {
  const rest = ["L", "I", "M", "B"];
  return (
    <div className="klimb-splash">
      <div className="klimb-wordmark">
        <img className="klimb-wordmark__k" src="/klimb-k-white.png" alt="Klimb" />
        <span className="klimb-wordmark__rest">
          {rest.map((ch, i) => (
            <span key={ch} style={{ animationDelay: `${0.55 + i * 0.11}s` }}>
              {ch}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
