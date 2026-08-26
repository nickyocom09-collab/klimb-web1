// Off-grid ("personal") logs: climbs saved to the user, not to any gym, while
// their gym isn't on Klimb yet. They stay private until the user transfers them
// into a real gym, at which point each becomes a normal logged climb (route +
// grade + rating + send/project) with its original date preserved.
import { supabase } from "./supabase";
import type { GymRow, PersonalLogRow, SendType } from "./database.types";
import type { RouteWithStats } from "./routes";
import type { LoggedItem, ProjectItem } from "./logstats";

export type { PersonalLogRow };

/** Quiet dark placeholder used when a climb has no photo — shared with the
 *  normal log path so a transferred route always has a valid photo_url. */
export const PLACEHOLDER_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='#1b1e1c'/><path d='M110 205 L175 125 L215 172 L250 140 L300 205 Z' fill='#2a2f2c'/><circle cx='250' cy='95' r='16' fill='#2a2f2c'/></svg>",
  );

/** Every off-grid climb the user still has waiting (not yet transferred). */
export async function fetchOffGridLogs(
  userId: string,
): Promise<PersonalLogRow[]> {
  const { data, error } = await supabase
    .from("personal_logs")
    .select("*")
    .eq("user_id", userId)
    .is("transferred_at", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data ?? [];
}

/** An approved gym whose name matches the label the user is waiting on, if one
 *  has since been added. Case-insensitive exact match keeps false positives
 *  low; the transfer prompt only appears when we're confident it's their gym. */
export async function findApprovedGymForLabel(
  label: string | null | undefined,
  logs: PersonalLogRow[] = [],
): Promise<GymRow | null> {
  const pendingIds = [
    ...new Set(logs.map((log) => log.pending_gym_id).filter(Boolean)),
  ] as string[];
  if (pendingIds.length > 0) {
    const { data } = await supabase
      .from("gyms")
      .select("*")
      .eq("status", "approved")
      .in("id", pendingIds)
      .limit(1);
    if (data?.[0]) return data[0];
  }
  const name = label?.trim();
  if (!name) return null;
  const { data } = await supabase
    .from("gyms")
    .select("*")
    .eq("status", "approved")
    .ilike("name", name)
    .limit(1);
  return data?.[0] ?? null;
}

export type TransferResult = { moved: number; failed: number };

/** Move each off-grid climb into a real gym. Each climb is its own RPC / DB
 *  transaction, so one failure never takes the others down — we just report how
 *  many made it. Returns the count moved and the count that failed. */
export async function transferOffGridLogs(
  logs: PersonalLogRow[],
  gymId: string,
): Promise<TransferResult> {
  let moved = 0;
  let failed = 0;
  for (const log of logs) {
    const { error } = await supabase.rpc("transfer_personal_log", {
      p_personal_log_id: log.id,
      p_gym_id: gymId,
    });
    if (error) failed += 1;
    else moved += 1;
  }
  return { moved, failed };
}

// --- Folding off-grid climbs into the personal logbook stats -----------------
// Off-grid climbs are real climbs and count toward the user's own totals,
// streaks, and pyramids. They carry no real route, so we synthesize a minimal
// RouteWithStats purely for the client-side stat math and display — it is never
// written to the database and never linked to a gym.

function syntheticRoute(pl: PersonalLogRow): RouteWithStats {
  return {
    id: pl.id,
    gym_id: "", // off-grid: belongs to no gym
    photo_url: pl.photo_url ?? PLACEHOLDER_PHOTO,
    video_url: null,
    hold_color: pl.hold_color,
    wall_section: null,
    climbing_type: pl.climbing_type,
    description: null,
    gym_grade: pl.gym_grade,
    name: pl.route_name,
    status: "active",
    hidden: false,
    report_count: 0,
    gone_reports: 0,
    community_grade_cached: null,
    created_by: pl.user_id,
    created_at: pl.created_at,
    archived_at: null,
    gradeValues: [],
    sendCount: 0,
    climbers: 0,
    avgAttempts: null,
    funAvg: null,
    funCount: 0,
    recentActivity: 0,
    gradingStyle: "classic",
  };
}

/** The synthetic route used to render an off-grid card the same way as a normal
 *  logbook row (photo, hold-color dot, grade stack). */
export function offGridRoute(pl: PersonalLogRow): RouteWithStats {
  return syntheticRoute(pl);
}

/** Convert raw off-grid rows into logbook items so they flow through the shared
 *  stat computation exactly like gym-linked climbs. Projects and sends split
 *  the same way log_climb splits them. */
export function offGridToLoggedItems(rows: PersonalLogRow[]): {
  logged: LoggedItem[];
  projects: ProjectItem[];
} {
  const logged: LoggedItem[] = [];
  const projects: ProjectItem[] = [];
  for (const pl of rows) {
    const route = syntheticRoute(pl);
    if (pl.outcome === "project") {
      projects.push({
        route,
        since: pl.created_at,
        notePeek: pl.note?.trim() ? pl.note : null,
        attempts: null,
        topped: false,
        userGrade: pl.felt_grade,
      });
    } else {
      logged.push({
        route,
        sendType: pl.outcome as SendType,
        note: pl.note,
        attempts: null,
        date: pl.created_at,
        ordinal: pl.gym_grade ?? pl.felt_grade ?? null,
        userGrade: pl.felt_grade,
      });
    }
  }
  return { logged, projects };
}
