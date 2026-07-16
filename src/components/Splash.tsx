/**
 * Branded loading splash — just the white Klimb "K" mark (no app-icon square,
 * no rounded edges) on the app's soft green-tinted gradient. Eases in, then
 * breathes gently. No text, no spinners. Mirrors the pre-JS splash in
 * index.html for a seamless handoff.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <img className="klimb-splash__mark" src="/klimb-k-white.png" alt="Klimb" />
    </div>
  );
}
