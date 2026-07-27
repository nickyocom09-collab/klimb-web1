/**
 * Klimb's K mark, redrawn with carved blackletter terminals. The angular
 * construction keeps the original app-icon silhouette while the small spurs
 * and split strokes give it a more expressive, climbing-gothic voice.
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
      viewBox="0 0 100 112"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M18 12 30 3l12 9v31l6-6 4 4L78 13h13l-3 9 7 5-13 6-24 25 28 31 10-2-7 16H74l-5-11-24-25-3 3v21l7 5-11 11-12-9V64l-8 7-13-6 9-11 4 3V20l-6-4Zm24 35v8l8-9-4-4Zm0 22v11l4-5Z"
      />
      <path
        fill="currentColor"
        d="m14 7 8 5-9 8H5Zm2 66 10 6-9 10H7Zm58-61 12 1-8 9-7-3Zm0 83 14 8-5 6-13-5Z"
      />
    </svg>
  );
}
