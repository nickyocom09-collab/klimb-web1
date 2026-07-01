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

/** True if the two users already share a friendship row. */
export async function areFriends(a: string, b: string): Promise<boolean> {
  const { count } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`,
    );
  return (count ?? 0) > 0;
}

export async function addFriendById(
  myId: string,
  otherId: string,
): Promise<{ error: string | null }> {
  if (myId === otherId) return { error: "That's you!" };
  if (await areFriends(myId, otherId)) return { error: null };
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: myId, addressee_id: otherId, status: "accepted" });
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
  const { error } = await addFriendById(myId, person.id);
  return { error, name: person.display_name };
}

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
