import { supabase } from "./supabase";

export async function fetchProUserIds(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) return new Set();
  const { data, error } = await supabase.rpc("get_pro_badges", {
    p_user_ids: uniqueIds,
  });
  if (error) return new Set();
  return new Set(
    (data ?? []).filter((row) => row.is_pro).map((row) => row.user_id),
  );
}
