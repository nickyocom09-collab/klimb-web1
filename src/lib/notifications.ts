import { supabase } from "./supabase";

export type NotificationKind =
  | "new_route"
  | "reply"
  | "grade"
  | "send"
  | "friend_request"
  | "friend_accept";

export type Notification = {
  id: string;
  kind: NotificationKind;
  text: string;
  /** Where tapping the notification goes. */
  link: string;
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
 * Derive in-app notifications for a user (no notifications table needed for
 * v1 — everything is computed from existing rows):
 *  1. New routes added at their home gym by other climbers.
 *  2. Replies (comments) by others on routes they created or commented on.
 *  3. Grades and sends by others on routes they posted.
 *  4. Friend requests waiting on them + requests of theirs that got accepted.
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
  const unread = (iso: string) => new Date(iso).getTime() > seen;

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

  const myRouteIds = (myRoutes ?? []).map((r) => r.id);
  const watchedRouteIds = new Set<string>(myRouteIds);
  for (const c of myComments ?? []) watchedRouteIds.add(c.route_id);

  // Resolve labels for any route we might reference.
  const labelMap = new Map<string, string>();
  for (const r of [...gymRoutes, ...(myRoutes ?? [])]) {
    labelMap.set(r.id, `${r.hold_color} on ${r.wall_section}`);
  }
  const label = (routeId: string) => labelMap.get(routeId) ?? "a route";

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

  // --- 3. Grades + sends by others on routes I posted ----------------------
  let gradeEvents: { id: string; route_id: string; user_id: string; created_at: string }[] = [];
  let sendEvents: {
    id: string;
    route_id: string;
    user_id: string;
    send_type: string;
    created_at: string;
  }[] = [];
  if (myRouteIds.length > 0) {
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase
        .from("grades")
        .select("id, route_id, user_id, created_at")
        .in("route_id", myRouteIds)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("sends")
        .select("id, route_id, user_id, send_type, created_at")
        .in("route_id", myRouteIds)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);
    gradeEvents = g ?? [];
    sendEvents = s ?? [];
  }

  // --- 4. Friend requests + accepts ----------------------------------------
  const [{ data: requests }, { data: accepts }] = await Promise.all([
    supabase
      .from("friendships")
      .select("id, requester_id, created_at")
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("friendships")
      .select("id, addressee_id, created_at")
      .eq("requester_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // --- Resolve actor names + any missing route labels ----------------------
  const actorIds = new Set<string>([
    ...replies.map((r) => r.user_id),
    ...gradeEvents.map((g) => g.user_id),
    ...sendEvents.map((s) => s.user_id),
    ...(requests ?? []).map((f) => f.requester_id),
    ...(accepts ?? []).map((f) => f.addressee_id),
  ]);
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
  const name = (id: string) => nameMap.get(id) ?? "A climber";

  // --- Assemble -------------------------------------------------------------
  for (const r of gymRoutes) {
    if (r.created_by === userId) continue;
    notes.push({
      id: `route-${r.id}`,
      kind: "new_route",
      text: `New route at your gym — ${label(r.id)}`,
      link: `/route/${r.id}`,
      createdAt: r.created_at,
      unread: unread(r.created_at),
    });
  }
  for (const c of replies) {
    notes.push({
      id: `reply-${c.id}`,
      kind: "reply",
      text: `${name(c.user_id)} commented on ${label(c.route_id)}`,
      link: `/route/${c.route_id}`,
      createdAt: c.created_at,
      unread: unread(c.created_at),
    });
  }
  for (const g of gradeEvents) {
    notes.push({
      id: `grade-${g.id}`,
      kind: "grade",
      text: `${name(g.user_id)} graded your route ${label(g.route_id)}`,
      link: `/route/${g.route_id}`,
      createdAt: g.created_at,
      unread: unread(g.created_at),
    });
  }
  for (const s of sendEvents) {
    notes.push({
      id: `send-${s.id}`,
      kind: "send",
      text: `${name(s.user_id)} ${
        s.send_type === "flash" ? "flashed" : "sent"
      } your route ${label(s.route_id)}`,
      link: `/route/${s.route_id}`,
      createdAt: s.created_at,
      unread: unread(s.created_at),
    });
  }
  for (const f of requests ?? []) {
    notes.push({
      id: `freq-${f.id}`,
      kind: "friend_request",
      text: `${name(f.requester_id)} sent you a friend request`,
      link: "/friends",
      createdAt: f.created_at,
      unread: unread(f.created_at),
    });
  }
  for (const f of accepts ?? []) {
    notes.push({
      id: `facc-${f.id}`,
      kind: "friend_accept",
      text: `You and ${name(f.addressee_id)} are now friends`,
      link: `/u/${f.addressee_id}`,
      createdAt: f.created_at,
      unread: unread(f.created_at),
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
