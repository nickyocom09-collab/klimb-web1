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
      viewBox="27 16 88 88"
      fill="currentColor"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M42 26 L54 18 L54 55 L42 67 Z" />
      <path d="M42 72 L54 60 L54 96 L42 104 Z" />
      <path d="M88 22 L100 22 L60 66 L51 57 Z" />
      <path d="M58 71 L67 62 L101 100 L88 100 Z" />
    </svg>
  );
}
