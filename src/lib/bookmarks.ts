import { supabase } from "./supabase";
import type { BookmarkKind } from "./database.types";

/** Which bookmark kinds a user has set on a single route. */
export async function fetchRouteBookmarks(
  userId: string,
  routeId: string,
): Promise<Set<BookmarkKind>> {
  const { data } = await supabase
    .from("bookmarks")
    .select("kind")
    .eq("user_id", userId)
    .eq("route_id", routeId);
  return new Set((data ?? []).map((b) => b.kind));
}

/** Add or remove a bookmark of a given kind; returns the new "active" state. */
export async function toggleBookmark(
  userId: string,
  routeId: string,
  kind: BookmarkKind,
  active: boolean,
): Promise<boolean> {
  if (active) {
    await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("route_id", routeId)
      .eq("kind", kind);
    return false;
  }
  await supabase
    .from("bookmarks")
    .upsert(
      { user_id: userId, route_id: routeId, kind },
      { onConflict: "user_id,route_id,kind", ignoreDuplicates: true },
    );
  return true;
}

/** Route ids the user has bookmarked under a given kind, newest first. */
export async function fetchBookmarkedRouteIds(
  userId: string,
  kind: BookmarkKind,
): Promise<string[]> {
  const { data } = await supabase
    .from("bookmarks")
    .select("route_id, created_at")
    .eq("user_id", userId)
    .eq("kind", kind)
    .order("created_at", { ascending: false });
  return (data ?? []).map((b) => b.route_id);
}
