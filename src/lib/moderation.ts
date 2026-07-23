import { supabase } from "./supabase";
import type { ContentReason } from "./constants";
import type { ReportTargetType } from "./database.types";

/** Ids the user has blocked — their content should be hidden everywhere. */
export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  return new Set((data ?? []).map((b) => b.blocked_id));
}

export type BlockedProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

/** The people the user has blocked, with profile info — for the manage list. */
export async function fetchBlockedProfiles(
  userId: string,
): Promise<BlockedProfile[]> {
  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  const ids = (data ?? []).map((b) => b.blocked_id);
  if (ids.length === 0) return [];
  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", ids);
  return people ?? [];
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("blocks")
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
    );
  return { error: error ? error.message : null };
}

export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
}

/**
 * Report a comment or user. Returns the running report count (a comment is
 * auto-hidden server-side once 3 distinct climbers report it).
 */
export async function reportContent(
  targetType: ReportTargetType,
  targetId: string,
  reason: ContentReason,
  note?: string,
): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase.rpc("report_content", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_note: note ?? null,
  });
  return { count: data ?? 0, error: error ? error.message : null };
}
