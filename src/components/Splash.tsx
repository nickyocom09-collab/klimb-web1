/** Minimal adaptive handoff shared with the pre-JS and native launch screens. */
export function Splash() {
  return (
    <div className="klimb-splash">
      <div className="klimb-splash__stage">
        <img
          className="klimb-splash__mark klimb-splash__mark--dark"
          src="/klimb-splash-dark.png"
          alt="Klimb"
        />
        <img
          className="klimb-splash__mark klimb-splash__mark--light"
          src="/klimb-splash-light.png"
          alt="Klimb"
        />
      </div>
    </div>
  );
}
