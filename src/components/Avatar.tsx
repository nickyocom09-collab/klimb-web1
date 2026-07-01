/** Round avatar: shows the uploaded image, else a colored initial. */
export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: number;
}) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "avatar"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold text-accent"
    >
      {initial}
    </span>
  );
}
