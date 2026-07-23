/**
 * The Klimb "K" mark — just the letterform, no app-icon square. Fills with
 * currentColor so callers control the color (cream on the splash, accent
 * green in the intro). Geometry mirrors the app icon / favicon.
 */
export function KMark({
  className,
  title = "Klimb",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="20 10 100 100"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinejoin="round"
        strokeLinecap="round"
        // Optical centering: the outline's bounding box is centered, but the
        // solid left leg outweighs the right side's tapering diagonal strokes,
        // so the ink itself reads left-heavy. Nudge right to balance the two.
        transform="translate(7.21, 0)"
      >
        <path d="M42 27 L54 19 L54 55 L42 66 Z" />
        <path d="M42 73 L54 61 L54 96 L42 104 Z" />
        <path d="M88 23 L99 23 L60 66 L51 57 Z" />
        <path d="M59 71 L67 63 L100 99 L88 99 Z" />
      </g>
    </svg>
  );
}
