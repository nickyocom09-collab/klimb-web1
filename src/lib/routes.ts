import { supabase } from "./supabase";
import type { GradingStyle, RouteRow } from "./database.types";

export type RouteWithStats = RouteRow & {
  gradeValues: number[];
  sendCount: number;
  /** Average 1-5 "fun factor" rating, null when unrated. */
  funAvg: number | null;
  funCount: number;
  /** Sends + grades logged in the last 7 days — the trending signal. */
  recentActivity: number;
  /** The gym's house grading style ('classic' scales or Bentonville 'bands'). */
  gradingStyle: GradingStyle;
};

// Raw select shape: route columns plus the joined gym grading style.
type RouteJoinRow = RouteRow & { gyms: { grading_style: GradingStyle } | null };

const ROUTE_SELECT = "*, gyms(grading_style)";

function flatten(rows: RouteJoinRow[]): (RouteRow & { gradingStyle: GradingStyle })[] {
  return rows.map(({ gyms, ...route }) => ({
    ...route,
    gradingStyle: gyms?.grading_style ?? "classic",
  }));
}

const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Attach grade values, send counts, fun ratings, and recent-activity counts
 * to a set of routes. Aggregation happens in Postgres (route_stats view) —
 * one query instead of pulling every grade/send/rating row to the client. */
async function attachStats(
  routes: (RouteRow & { gradingStyle: GradingStyle })[],
): Promise<RouteWithStats[]> {
  if (routes.length === 0) return [];
  const ids = routes.map((r) => r.id);

  const { data: stats } = await supabase
    .from("route_stats")
    .select("*")
    .in("route_id", ids);
  const statMap = new Map((stats ?? []).map((s) => [s.route_id, s]));

  return routes.map((r) => {
    const s = statMap.get(r.id);
    return {
      ...r,
      gradeValues: s?.grade_values ?? [],
      sendCount: s?.send_count ?? 0,
      funAvg: s?.fun_avg ?? null,
      funCount: s?.fun_count ?? 0,
      recentActivity: s?.recent_activity ?? 0,
    };
  });
}

/** True when the route was added within the last 7 days. */
export function isNewThisWeek(route: RouteRow): boolean {
  return Date.now() - new Date(route.created_at).getTime() < TRENDING_WINDOW_MS;
}

/** True when the route has enough recent activity to call it trending. */
export function isTrending(route: RouteWithStats): boolean {
  return route.recentActivity >= 4;
}

export async function fetchActiveRoutes(
  gymId: string,
): Promise<RouteWithStats[]> {
  const { data, error } = await supabase
    .from("routes")
    .select(ROUTE_SELECT)
    .eq("gym_id", gymId)
    .eq("status", "active")
    .eq("hidden", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return attachStats(flatten((data ?? []) as unknown as RouteJoinRow[]));
}

/** Fetch a set of routes by id, preserving the given order, with stats. */
export async function fetchRoutesByIds(
  ids: string[],
): Promise<RouteWithStats[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("routes")
    .select(ROUTE_SELECT)
    .in("id", ids);
  if (error) throw error;
  const withStats = await attachStats(
    flatten((data ?? []) as unknown as RouteJoinRow[]),
  );
  const order = new Map(ids.map((id, i) => [id, i]));
  return withStats.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
}

export async function fetchRoute(id: string): Promise<RouteWithStats | null> {
  const { data, error } = await supabase
    .from("routes")
    .select(ROUTE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [withStats] = await attachStats(
    flatten([data as unknown as RouteJoinRow]),
  );
  return withStats;
}
