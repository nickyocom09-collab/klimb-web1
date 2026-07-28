/** A gym-provided route name wins; the hold color remains the fallback. */
export function routeLabel(route: { name?: string | null; hold_color: string }): string {
  return route.name?.trim() || route.hold_color;
}
