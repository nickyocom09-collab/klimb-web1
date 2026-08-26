const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const SAFE_NOTIFICATION_PATHS = [
  new RegExp(`^/u/${UUID}$`, "i"),
  new RegExp(`^/route/${UUID}$`, "i"),
  new RegExp(`^/stats\\?recap=${UUID}$`, "i"),
  /^\/friends(?:\/manage)?$/,
  /^\/notifications$/,
];

/** Keep notification taps inside known app routes. Both the in-app bell and
 * APNs use this resolver so malformed data cannot become an external or dead
 * navigation. */
export function notificationDestination(value: unknown): string {
  if (typeof value !== "string") return "/notifications";
  return SAFE_NOTIFICATION_PATHS.some((pattern) => pattern.test(value))
    ? value
    : "/notifications";
}
