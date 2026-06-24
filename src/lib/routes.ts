import { supabase } from "./supabase";
import type { RouteRow } from "./database.types";

export type RouteWithStats = RouteRow & {
  gradeValues: number[];
  sendCount: number;
};

/** Attach grade values + send counts to a set of routes (client-side aggregate). */
async function attachStats(routes: RouteRow[]): Promise<RouteWithStats[]> {
  if (routes.length === 0) return [];
  const ids = routes.map((r) => r.id);

  const [{ data: grades }, { data: sends }] = await Promise.all([
    supabase.from("grades").select("route_id, grade").in("route_id", ids),
    supabase.from("sends").select("route_id").in("route_id", ids),
  ]);

  const gradeMap = new Map<string, number[]>();
  for (const g of grades ?? []) {
    const arr = gradeMap.get(g.route_id) ?? [];
    arr.push(g.grade);
    gradeMap.set(g.route_id, arr);
  }
  const sendMap = new Map<string, number>();
  for (const s of sends ?? []) {
    sendMap.set(s.route_id, (sendMap.get(s.route_id) ?? 0) + 1);
  }

  return routes.map((r) => ({
    ...r,
    gradeValues: gradeMap.get(r.id) ?? [],
    sendCount: sendMap.get(r.id) ?? 0,
  }));
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
