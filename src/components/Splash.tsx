import { KMark } from "./KMark";

/** Premium branded handoff shared with the pre-JS and native launch screens. */
export function Splash() {
  return (
    <div className="klimb-splash">
      <div className="klimb-splash__atmosphere" aria-hidden="true" />
      <div className="klimb-splash__stage">
        <span className="klimb-splash__halo" aria-hidden="true" />
        <span className="klimb-splash__orbit" aria-hidden="true" />
        <KMark className="klimb-splash__mark" />
      </div>
      <p className="klimb-splash__wordmark">Klimb</p>
      <span className="klimb-splash__line" aria-hidden="true" />
    </div>
  );
}
