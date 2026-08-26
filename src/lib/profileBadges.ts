import { supabase } from "./supabase";

export type ProfileBadge = {
  user_id: string;
  badge_key: "slab_king";
  label: string;
};

export async function fetchProfileBadges(
  userIds: string[],
): Promise<Map<string, ProfileBadge>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profile_badges")
    .select("user_id, badge_key, label")
    .in("user_id", uniqueIds);
  if (error) return new Map();

  return new Map(
    (data ?? []).map((badge) => [badge.user_id, badge as ProfileBadge]),
  );
}
