import { supabase } from "./supabase";

/**
 * Share a climb to another Klimb user (in-app "send to a friend"). Surfaces on
 * the recipient's side as a notification (see notifications.ts).
 */
export async function sendClimbToFriend(
  routeId: string,
  fromUser: string,
  toUser: string,
  message?: string,
): Promise<void> {
  const { error } = await supabase.from("climb_shares").insert({
    route_id: routeId,
    from_user: fromUser,
    to_user: toUser,
    message: message?.trim() || null,
  });
  if (error) throw error;
}
