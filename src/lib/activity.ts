import { supabase } from "./supabase";
import type { ClimbingTypeEnum } from "./database.types";

export type ActivityKind = "send" | "grade" | "comment" | "new_route";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  actor: string;
  userId: string;
  routeId: string;
  routeLabel: string; // e.g. "Red on Cave"
  climbingType: ClimbingTypeEnum;
  grade?: number; // for grade events
  createdAt: string;
};

type RouteMeta = {
  hold_color: string;
  climbing_type: ClimbingTypeEnum;
  created_by: string | null;
  created_at: string;
};

/**
 * Build a gym-scoped activity timeline from existing tables (sends, grades,
 * comments, new routes). No follow graph — everything happening at the gym.
 * Events from blocked users are filtered out.
 */
export async function fetchGymActivity(
  gymId: string,
  blockedIds: Set<string> = new Set(),
  limit = 40,
): Promise<ActivityEvent[]> {
  const { data: routes } = await supabase
    .from("routes")
    .select("id, hold_color, climbing_type, created_by, created_at")
    .eq("gym_id", gymId);

  if (!routes || routes.length === 0) return [];

  const routeMeta = new Map<string, RouteMeta>();
  const routeIds: string[] = [];
  for (const r of routes) {
    routeIds.push(r.id);
    routeMeta.set(r.id, {
      hold_color: r.hold_color,
      climbing_type: r.climbing_type,
      created_by: r.created_by,
      created_at: r.created_at,
    });
  }

  const [{ data: sends }, { data: grades }, { data: comments }] =
    await Promise.all([
      supabase
        .from("sends")
        .select("id, route_id, user_id, created_at")
        .in("route_id", routeIds)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("grades")
        .select("id, route_id, user_id, grade, created_at")
        .in("route_id", routeIds)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("comments")
        .select("id, route_id, user_id, created_at")
        .in("route_id", routeIds)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

  // Collect all the actor ids so we can resolve display names in one query.
  const userIds = new Set<string>();
  for (const s of sends ?? []) userIds.add(s.user_id);
  for (const g of grades ?? []) userIds.add(g.user_id);
  for (const c of comments ?? []) userIds.add(c.user_id);
  for (const r of routes) if (r.created_by) userIds.add(r.created_by);

  const nameMap = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(userIds));
    for (const p of people ?? []) nameMap.set(p.id, p.display_name);
  }

  const label = (rid: string) => {
    const m = routeMeta.get(rid);
    return m ? `${m.hold_color}` : "a route";
  };

  const events: ActivityEvent[] = [];

  for (const s of sends ?? []) {
    const m = routeMeta.get(s.route_id);
    events.push({
      id: `send-${s.id}`,
      kind: "send",
      actor: nameMap.get(s.user_id) ?? "A climber",
      userId: s.user_id,
      routeId: s.route_id,
      routeLabel: label(s.route_id),
      climbingType: m?.climbing_type ?? "boulder",
      createdAt: s.created_at,
    });
  }
  for (const g of grades ?? []) {
    const m = routeMeta.get(g.route_id);
    events.push({
      id: `grade-${g.id}`,
      kind: "grade",
      actor: nameMap.get(g.user_id) ?? "A climber",
      userId: g.user_id,
      routeId: g.route_id,
      routeLabel: label(g.route_id),
      climbingType: m?.climbing_type ?? "boulder",
      grade: g.grade,
      createdAt: g.created_at,
    });
  }
  for (const c of comments ?? []) {
    const m = routeMeta.get(c.route_id);
    events.push({
      id: `comment-${c.id}`,
      kind: "comment",
      actor: nameMap.get(c.user_id) ?? "A climber",
      userId: c.user_id,
      routeId: c.route_id,
      routeLabel: label(c.route_id),
      climbingType: m?.climbing_type ?? "boulder",
      createdAt: c.created_at,
    });
  }
  for (const r of routes) {
    if (!r.created_by) continue;
    events.push({
      id: `route-${r.id}`,
      kind: "new_route",
      actor: nameMap.get(r.created_by) ?? "A climber",
      userId: r.created_by,
      routeId: r.id,
      routeLabel: label(r.id),
      climbingType: r.climbing_type,
      createdAt: r.created_at,
    });
  }

  return events
    .filter((e) => !blockedIds.has(e.userId))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}
