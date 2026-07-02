import { supabase } from "./supabase";
import type { RouteRow } from "./database.types";

export type RouteWithStats = RouteRow & {
  gradeValues: number[];
  sendCount: number;
  /** Average 1-5 "fun factor" rating, null when unrated. */
  funAvg: number | null;
  funCount: number;
  /** Sends + grades logged in the last 7 days — the trending signal. */
  recentActivity: number;
};

const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Attach grade values, send counts, fun ratings, and recent-activity counts
 * to a set of routes (client-side aggregate). */
async function attachStats(routes: RouteRow[]): Promise<RouteWithStats[]> {
  if (routes.length === 0) return [];
  const ids = routes.map((r) => r.id);

  const [{ data: grades }, { data: sends }, { data: ratings }] =
    await Promise.all([
      supabase
        .from("grades")
        .select("route_id, grade, created_at")
        .in("route_id", ids),
      supabase.from("sends").select("route_id, created_at").in("route_id", ids),
      supabase.from("route_ratings").select("route_id, stars").in("route_id", ids),
    ]);

  const cutoff = Date.now() - TRENDING_WINDOW_MS;
  const recentMap = new Map<string, number>();
  const bumpRecent = (routeId: string, createdAt: string) => {
    if (new Date(createdAt).getTime() >= cutoff)
      recentMap.set(routeId, (recentMap.get(routeId) ?? 0) + 1);
  };

  const gradeMap = new Map<string, number[]>();
  for (const g of grades ?? []) {
    const arr = gradeMap.get(g.route_id) ?? [];
    arr.push(g.grade);
    gradeMap.set(g.route_id, arr);
    bumpRecent(g.route_id, g.created_at);
  }
  const sendMap = new Map<string, number>();
  for (const s of sends ?? []) {
    sendMap.set(s.route_id, (sendMap.get(s.route_id) ?? 0) + 1);
    bumpRecent(s.route_id, s.created_at);
  }
  const funMap = new Map<string, { sum: number; n: number }>();
  for (const r of ratings ?? []) {
    const cur = funMap.get(r.route_id) ?? { sum: 0, n: 0 };
    cur.sum += r.stars;
    cur.n += 1;
    funMap.set(r.route_id, cur);
  }

  return routes.map((r) => {
    const fun = funMap.get(r.id);
    return {
      ...r,
      gradeValues: gradeMap.get(r.id) ?? [],
      sendCount: sendMap.get(r.id) ?? 0,
      funAvg: fun ? fun.sum / fun.n : null,
      funCount: fun?.n ?? 0,
      recentActivity: recentMap.get(r.id) ?? 0,
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
    .select("*")
    .eq("gym_id", gymId)
    .eq("status", "active")
    .eq("hidden", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return attachStats(data ?? []);
}

/** Fetch a set of routes by id, preserving the given order, with stats. */
export async function fetchRoutesByIds(
  ids: string[],
): Promise<RouteWithStats[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  const withStats = await attachStats(data ?? []);
  const order = new Map(ids.map((id, i) => [id, i]));
  return withStats.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
}

export async function fetchRoute(id: string): Promise<RouteWithStats | null> {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [withStats] = await attachStats([data]);
  return withStats;
}
