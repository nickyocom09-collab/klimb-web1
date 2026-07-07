import { supabase } from "./supabase";
import type { Database, RecapPayload } from "./database.types";

export type RecapRow = Database["public"]["Tables"]["recaps"]["Row"];

/** Latest weekly + monthly recap and a short history, newest first. */
export async function fetchRecaps(userId: string): Promise<{
  latestWeekly: RecapRow | null;
  latestMonthly: RecapRow | null;
  history: RecapRow[];
}> {
  const { data } = await supabase
    .from("recaps")
    .select("*")
    .eq("user_id", userId)
    .order("period_start", { ascending: false })
    .limit(24);
  const rows = data ?? [];
  return {
    latestWeekly: rows.find((r) => r.period === "weekly") ?? null,
    latestMonthly: rows.find((r) => r.period === "monthly") ?? null,
    history: rows,
  };
}

export async function markRecapSeen(id: string): Promise<void> {
  await supabase
    .from("recaps")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", id);
}

/** ms until the next Sunday 7:00 PM in the user's local time. */
export function msUntilNextRecap(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(19, 0, 0, 0);
  const day = now.getDay(); // 0 = Sunday
  let addDays = (7 - day) % 7;
  if (addDays === 0 && now.getTime() >= next.getTime()) addDays = 7;
  next.setDate(next.getDate() + addDays);
  return next.getTime() - now.getTime();
}

export function recapCountdownLabel(): string {
  const ms = msUntilNextRecap();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % (60 * 60 * 1000)) / 60000);
  return `${hours}h ${mins}m`;
}

/** A playful title earned from the shape of the period. */
export function superlative(p: RecapPayload): { title: string; why: string } {
  const wallish = (p.top_wall ?? "").toLowerCase();
  if (p.new_grades.length > 0)
    return {
      title: "Breakthrough",
      why: `${p.new_grades.length} new grade${p.new_grades.length === 1 ? "" : "s"} unlocked`,
    };
  if ((p.flash_rate ?? 0) >= 60 && p.flashes >= 3)
    return { title: "Flash Royalty", why: `${p.flash_rate}% flash rate` };
  if (p.climbs > 0 && p.attempts / Math.max(p.climbs, 1) >= 3)
    return {
      title: "Project Grinder",
      why: `${p.attempts} tries across ${p.climbs} climbs`,
    };
  if (p.prev.climbs === 0 && p.climbs > 0)
    return { title: "Comeback Kid", why: "back on the wall this period" };
  if (p.climbs >= p.prev.climbs * 1.5 && p.prev.climbs > 0)
    return { title: "Volume Monster", why: "way up on last period" };
  if (wallish.includes("slab"))
    return { title: "Slab Slayer", why: `${p.top_wall} regular` };
  if (wallish.includes("overhang") || wallish.includes("cave") || wallish.includes("roof"))
    return { title: "Steep Specialist", why: `lives on the ${p.top_wall}` };
  if (p.sessions >= 3)
    return { title: "Consistency King", why: `${p.sessions} sessions` };
  return { title: "Crusher in Training", why: "putting in the work" };
}
