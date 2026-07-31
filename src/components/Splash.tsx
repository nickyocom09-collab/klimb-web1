/**
 * In-app loading screen. Deliberately identical to the native launch screen and
 * the pre-JS boot splash in index.html: the same artwork, the same 224pt box,
 * always dark in every theme on every device.
 *
 * That sameness is the whole point — there is no variant that can be picked
 * wrongly and nothing that shifts, so the handoff between the three is
 * invisible. If you change the mark or its size, change it in all three places.
 */
export function Splash() {
  return (
    <div className="klimb-splash">
      <div className="klimb-splash__stage">
        <img
          className="klimb-splash__mark"
          src="/klimb-splash-dark.png"
          alt="Klimb"
        />
      </div>
    </div>
  );
}
