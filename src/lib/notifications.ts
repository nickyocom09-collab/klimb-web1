import { supabase } from "./supabase";

export type NotificationKind = "friend_request" | "friend_accept" | "recap";

export type Notification = {
  id: string;
  kind: NotificationKind;
  text: string;
  /** Where tapping the notification goes. */
  link: string;
  createdAt: string;
  unread: boolean;
};

/**
 * In-app notifications — friends only. Klimb is an individual logbook, so the
 * only things worth pinging about are social: someone sent you a friend
 * request, or a request of yours got accepted. Derived from the friendships
 * table (no notifications table needed). "unread" = created after the user's
 * notifications_seen_at marker; anything before notifications_cleared_at is
 * hidden (the Clear button).
 */
export async function fetchNotifications(
  userId: string,
  seenAt: string | null,
  clearedAt: string | null,
  limit = 30,
): Promise<Notification[]> {
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  const cleared = clearedAt ? new Date(clearedAt).getTime() : 0;
  const notes: Notification[] = [];

  const [{ data: requests }, { data: accepts }, { data: recaps }] =
    await Promise.all([
      supabase
        .from("friendships")
        .select("id, requester_id, created_at")
        .eq("addressee_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("friendships")
        .select("id, addressee_id, created_at")
        .eq("requester_id", userId)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("recaps")
        .select("id, created_at, seen_at")
        .eq("user_id", userId)
        .eq("period", "weekly")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const actorIds = new Set<string>([
    ...(requests ?? []).map((f) => f.requester_id),
    ...(accepts ?? []).map((f) => f.addressee_id),
  ]);
  const nameMap = new Map<string, string>();
  if (actorIds.size > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(actorIds));
    for (const p of data ?? []) nameMap.set(p.id, p.display_name);
  }
  const name = (id: string) => nameMap.get(id) ?? "A climber";

  for (const f of requests ?? []) {
    notes.push({
      id: `freq-${f.id}`,
      kind: "friend_request",
      text: `${name(f.requester_id)} sent you a friend request`,
      link: "/friends",
      createdAt: f.created_at,
      unread: new Date(f.created_at).getTime() > seen,
    });
  }
  for (const f of accepts ?? []) {
    notes.push({
      id: `facc-${f.id}`,
      kind: "friend_accept",
      text: `You and ${name(f.addressee_id)} are now friends`,
      link: `/u/${f.addressee_id}`,
      createdAt: f.created_at,
      unread: new Date(f.created_at).getTime() > seen,
    });
  }
  for (const r of recaps ?? []) {
    notes.push({
      id: `recap-${r.id}`,
      kind: "recap",
      text: "Your weekly recap is ready 🎬",
      link: "/",
      createdAt: r.created_at,
      // Unread until you've actually watched it.
      unread: !r.seen_at,
    });
  }

  return notes
    .filter((n) => new Date(n.createdAt).getTime() > cleared)
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

/** Clear the notification list — hides everything up to now. */
export async function clearNotifications(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("profiles")
    .update({ notifications_cleared_at: now, notifications_seen_at: now })
    .eq("id", userId);
}
