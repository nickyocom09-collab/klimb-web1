import { supabase } from "./supabase";

export type FriendProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

/** Everyone the current user is connected to (either direction). */
export async function fetchFriends(myId: string): Promise<FriendProfile[]> {
  const { data } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
    .eq("status", "accepted");
  const otherIds = [
    ...new Set(
      (data ?? []).map((f) =>
        f.requester_id === myId ? f.addressee_id : f.requester_id,
      ),
    ),
  ];
  if (otherIds.length === 0) return [];
  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", otherIds);
  return people ?? [];
}

/**
 * My relationship to another climber:
 *  - "none"        no row between us
 *  - "pending_out" I sent them a request, waiting on them
 *  - "pending_in"  they sent me a request, waiting on me
 *  - "friends"     accepted, both ways
 */
export type FriendStatus = "none" | "pending_out" | "pending_in" | "friends";

export async function friendshipStatus(
  myId: string,
  otherId: string,
): Promise<FriendStatus> {
  const { data } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`,
    )
    .maybeSingle();
  if (!data) return "none";
  if (data.status === "accepted") return "friends";
  return data.requester_id === myId ? "pending_out" : "pending_in";
}

/** True if the two users already share a friendship row (any status). */
export async function areFriends(a: string, b: string): Promise<boolean> {
  const { count } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`,
    );
  return (count ?? 0) > 0;
}

/** Send a friend request — creates a PENDING row, not an instant friendship. */
export async function addFriendById(
  myId: string,
  otherId: string,
): Promise<{ error: string | null }> {
  if (myId === otherId) return { error: "That's you!" };
  const existing = await friendshipStatus(myId, otherId);
  // Already connected or requested in some way — nothing new to send. If they
  // already requested us, accepting is the right move (handled by the UI).
  if (existing !== "none") return { error: null };
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: myId, addressee_id: otherId, status: "pending" });
  return { error: error ? error.message : null };
}

export async function addFriendByUsername(
  myId: string,
  username: string,
): Promise<{ error: string | null; name?: string }> {
  const handle = username.trim().replace(/^@/, "");
  if (!handle) return { error: "Enter a username." };
  const { data: person } = await supabase
    .from("profiles")
    .select("id, display_name")
    .ilike("username", handle)
    .maybeSingle();
  if (!person) return { error: `No climber found with @${handle}.` };
  if (person.id === myId) return { error: "That's you!" };
  const status = await friendshipStatus(myId, person.id);
  if (status === "friends")
    return { error: `You're already friends with ${person.display_name}.` };
  if (status === "pending_out")
    return { error: `You've already requested ${person.display_name}.` };
  if (status === "pending_in")
    return {
      error: `${person.display_name} already sent you a request — check your requests to accept.`,
    };
  const { error } = await addFriendById(myId, person.id);
  return { error, name: person.display_name };
}

/** Incoming friend requests waiting on me to accept or decline. */
export async function fetchPendingRequests(
  myId: string,
): Promise<FriendProfile[]> {
  const { data } = await supabase
    .from("friendships")
    .select("requester_id")
    .eq("addressee_id", myId)
    .eq("status", "pending");
  const ids = (data ?? []).map((r) => r.requester_id);
  if (ids.length === 0) return [];
  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", ids);
  return people ?? [];
}

/** Accept a request that `requesterId` sent me. */
export async function acceptFriendRequest(
  myId: string,
  requesterId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("requester_id", requesterId)
    .eq("addressee_id", myId)
    .eq("status", "pending");
  return { error: error ? error.message : null };
}

/** Decline a request `requesterId` sent me — just drops the row. */
export async function declineFriendRequest(
  myId: string,
  requesterId: string,
): Promise<void> {
  await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", requesterId)
    .eq("addressee_id", myId)
    .eq("status", "pending");
}

/** Remove a friend, or cancel a request I sent (either direction, any status). */
export async function removeFriend(
  myId: string,
  otherId: string,
): Promise<void> {
  await supabase
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`,
    );
}
