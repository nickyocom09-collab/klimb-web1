import { supabase } from "./supabase";

export type NotificationKind = "new_route" | "reply";

export type Notification = {
  id: string;
  kind: NotificationKind;
  text: string;
  routeId: string;
  createdAt: string;
  unread: boolean;
};

type RouteLite = {
  id: string;
  hold_color: string;
  wall_section: string;
  created_by: string | null;
  created_at: string;
};

/**
 * Derive in-app notifications for a user (no notifications table needed for v1):
 *  1. New routes added at their home gym by other climbers.
 *  2. Replies (comments) by others on routes they created or commented on.
 * "unread" = created after the user's notifications_seen_at marker.
 */
export async function fetchNotifications(
  userId: string,
  homeGymId: string | null,
  seenAt: string,
  limit = 30,
): Promise<Notification[]> {
  const seen = new Date(seenAt).getTime();
  const notes: Notification[] = [];

  // --- 1. New routes at the home gym (by others) ---------------------------
  let gymRoutes: RouteLite[] = [];
  if (homeGymId) {
    const { data } = await supabase
      .from("routes")
      .select("id, hold_color, wall_section, created_by, created_at")
      .eq("gym_id", homeGymId)
      .eq("status", "active")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    gymRoutes = data ?? [];
  }

  // --- gather routes the user "owns" or has engaged with -------------------
  const { data: myRoutes } = await supabase
    .from("routes")
    .select("id, hold_color, wall_section, created_by, created_at")
    .eq("created_by", userId);
  const { data: myComments } = await supabase
    .from("comments")
    .select("route_id")
    .eq("user_id", userId);

  const watchedRouteIds = new Set<string>();
  for (const r of myRoutes ?? []) watchedRouteIds.add(r.id);
  for (const c of myComments ?? []) watchedRouteIds.add(c.route_id);

  // Resolve labels for any route we might reference.
  const labelMap = new Map<string, string>();
  for (const r of [...gymRoutes, ...(myRoutes ?? [])]) {
    labelMap.set(r.id, `${r.hold_color} on ${r.wall_section}`);
  }

  // --- 2. Replies by others on watched routes ------------------------------
  let replies: {
    id: string;
    route_id: string;
    user_id: string;
    created_at: string;
  }[] = [];
  if (watchedRouteIds.size > 0) {
    const { data } = await supabase
      .from("comments")
      .select("id, route_id, user_id, created_at")
      .in("route_id", Array.from(watchedRouteIds))
      .neq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    replies = data ?? [];
  }

  // Resolve actor names + any missing route labels.
  const actorIds = new Set(replies.map((r) => r.user_id));
  const missingLabelIds = replies
    .map((r) => r.route_id)
    .filter((id) => !labelMap.has(id));
  if (missingLabelIds.length > 0) {
    const { data } = await supabase
      .from("routes")
      .select("id, hold_color, wall_section")
      .in("id", missingLabelIds);
    for (const r of data ?? [])
      labelMap.set(r.id, `${r.hold_color} on ${r.wall_section}`);
  }
  const nameMap = new Map<string, string>();
  if (actorIds.size > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(actorIds));
    for (const p of data ?? []) nameMap.set(p.id, p.display_name);
  }

  for (const r of gymRoutes) {
    if (r.created_by === userId) continue;
    notes.push({
      id: `route-${r.id}`,
      kind: "new_route",
      text: `New route at your gym — ${labelMap.get(r.id) ?? "a route"}`,
      routeId: r.id,
      createdAt: r.created_at,
      unread: new Date(r.created_at).getTime() > seen,
    });
  }
  for (const c of replies) {
    notes.push({
      id: `reply-${c.id}`,
      kind: "reply",
      text: `${nameMap.get(c.user_id) ?? "A climber"} commented on ${
        labelMap.get(c.route_id) ?? "a route"
      }`,
      routeId: c.route_id,
      createdAt: c.created_at,
      unread: new Date(c.created_at).getTime() > seen,
    });
  }

  return notes
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}

/** Move the user's "seen" marker to now, clearing the unread badge. */
export async function markNotificationsSeen(userId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq("id", userId);
}
