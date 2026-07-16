// Shared personal-logbook data + stats computation, used by the Logbook
// (home) and the Stats tab. Everything here derives from the user's OWN
// rows, so it's fully meaningful with zero other users.
import { supabase } from "./supabase";
import { fetchRoutesByIds, type RouteWithStats } from "./routes";
import { communityGrade, formatGradeStyled, type GradeSystem } from "./grades";
import type { SendType } from "./database.types";

export type LoggedItem = {
  route: RouteWithStats;
  sendType: SendType;
  note: string | null;
  attempts: number | null;
  date: string;
  /** Best-known ordinal for this climb: your grade > community > gym. */
  ordinal: number | null;
};

export type ProjectItem = {
  route: RouteWithStats;
  since: string;
  /** Latest private journal note for this project, if any. */
  notePeek: string | null;
  /** Tries logged so far (from an 'attempt' log), if any. */
  attempts: number | null;
};

export const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchLogbook(profileId: string): Promise<{
  logged: LoggedItem[];
  projects: ProjectItem[];
}> {
  const [{ data: sends }, { data: bms }, { data: myGradeRows }] =
    await Promise.all([
      supabase
        .from("sends")
        .select("route_id, send_type, note, attempts, created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookmarks")
        .select("route_id, created_at")
        .eq("user_id", profileId)
        .eq("kind", "project")
        .order("created_at", { ascending: false }),
      supabase
        .from("grades")
        .select("route_id, grade")
        .eq("user_id", profileId),
    ]);

  const sendRows = sends ?? [];
  const bmRows = bms ?? [];
  const myGrades = new Map(
    (myGradeRows ?? []).map((g) => [g.route_id, g.grade]),
  );
  const routeIds = [
    ...new Set([
      ...sendRows.map((s) => s.route_id),
      ...bmRows.map((b) => b.route_id),
    ]),
  ];
  const routes = await fetchRoutesByIds(routeIds);
  const byId = new Map(routes.map((r) => [r.id, r]));

  const logged: LoggedItem[] = sendRows
    .filter((s) => byId.has(s.route_id))
    .map((s) => {
      const route = byId.get(s.route_id)!;
      return {
        route,
        sendType: (s.send_type ?? "send") as SendType,
        note: s.note,
        attempts: s.attempts,
        date: s.created_at,
        ordinal:
          myGrades.get(s.route_id) ??
          communityGrade(route.gradeValues) ??
          route.gym_grade ??
          null,
      };
    });

  // Projects you haven't actually sent = "still projecting".
  const sentIds = new Set(
    sendRows.filter((s) => s.send_type !== "attempt").map((s) => s.route_id),
  );
  const projectRows = bmRows.filter(
    (b) => byId.has(b.route_id) && !sentIds.has(b.route_id),
  );

  // Attach each project's private note peek + tries so far.
  const projectIds = projectRows.map((b) => b.route_id);
  const noteMap = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: notes } = await supabase
      .from("project_notes")
      .select("route_id, body")
      .eq("user_id", profileId)
      .in("route_id", projectIds);
    for (const n of notes ?? []) if (n.body.trim()) noteMap.set(n.route_id, n.body);
  }
  const attemptMap = new Map<string, number>();
  for (const s of sendRows) {
    if (s.send_type === "attempt" && s.attempts)
      attemptMap.set(s.route_id, s.attempts);
  }

  const projects: ProjectItem[] = projectRows.map((b) => ({
    route: byId.get(b.route_id)!,
    since: b.created_at,
    notePeek: noteMap.get(b.route_id) ?? null,
    attempts: attemptMap.get(b.route_id) ?? null,
  }));

  return { logged, projects };
}

export type LogStats = {
  total: number;
  flashes: number;
  attemptsTotal: number;
  sessions: number;
  flashRate: number | null;
  thisWeek: number;
  lastWeek: number;
  topWall: string | null;
  topColor: string | null;
  /** Consecutive weeks with at least one log. Weekly on purpose — nobody
   * climbs every day; one session a week keeps the flame alive. The current
   * week gets a grace period: an empty week-so-far doesn't kill the streak. */
  streakWeeks: number;
  /** Days since the current streak started (0 when there's no streak). */
  streakDays: number;
  pyramid: { label: string; count: number; sort: number }[];
  hardestSend: { boulder: LoggedItem | null; toprope: LoggedItem | null };
  hardestFlash: { boulder: LoggedItem | null; toprope: LoggedItem | null };
  weeks: number[];
};

export function computeLogStats(
  logged: LoggedItem[],
  system: GradeSystem,
): LogStats {
  const now = Date.now();
  const sent = logged.filter((l) => l.sendType !== "attempt");
  const flashes = logged.filter((l) => l.sendType === "flash");
  const thisWeek = logged.filter(
    (l) => now - new Date(l.date).getTime() < 7 * DAY_MS,
  ).length;
  const lastWeek = logged.filter((l) => {
    const age = now - new Date(l.date).getTime();
    return age >= 7 * DAY_MS && age < 14 * DAY_MS;
  }).length;

  const mode = (vals: string[]): string | null => {
    if (vals.length === 0) return null;
    const counts = new Map<string, number>();
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  // Grade pyramid: sends bucketed by display label, easy→hard.
  const buckets = new Map<string, { count: number; sort: number }>();
  for (const l of sent) {
    if (l.ordinal === null) continue;
    const label = formatGradeStyled(
      l.ordinal,
      l.route.climbing_type,
      system,
      l.route.gradingStyle,
    );
    const sort = (l.route.climbing_type === "toprope" ? 100 : 0) + l.ordinal;
    const cur = buckets.get(label) ?? { count: 0, sort };
    cur.count += 1;
    buckets.set(label, cur);
  }
  const pyramid = [...buckets.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => a.sort - b.sort);

  const hardest = (items: LoggedItem[]) => {
    let boulder: LoggedItem | null = null;
    let toprope: LoggedItem | null = null;
    for (const l of items) {
      if (l.ordinal === null) continue;
      if (l.route.climbing_type === "boulder") {
        if (!boulder || l.ordinal > boulder.ordinal!) boulder = l;
      } else if (!toprope || l.ordinal > toprope.ordinal!) toprope = l;
    }
    return { boulder, toprope };
  };

  // Weekly streak: consecutive rolling weeks with >=1 log, counting back from
  // now. If this week is still empty, start from last week (grace) so the
  // streak only breaks after a full week off the wall.
  const weekHasLog = (i: number) =>
    logged.some((l) => {
      const t = new Date(l.date).getTime();
      return t >= now - (i + 1) * 7 * DAY_MS && t < now - i * 7 * DAY_MS;
    });
  let streakWeeks = 0;
  const graceStart = !weekHasLog(0); // streak counted from last week (grace)
  for (let i = weekHasLog(0) ? 0 : 1; weekHasLog(i); i++) streakWeeks++;

  // Days since the streak began = days from the oldest log in the streak span.
  let streakDays = 0;
  if (streakWeeks > 0) {
    const weeksBack = streakWeeks + (graceStart ? 1 : 0);
    const spanStart = now - weeksBack * 7 * DAY_MS;
    const inStreak = logged
      .map((l) => new Date(l.date).getTime())
      .filter((t) => t >= spanStart);
    if (inStreak.length > 0) {
      streakDays = Math.max(1, Math.floor((now - Math.min(...inStreak)) / DAY_MS));
    }
  }

  // Sends per week for the last 8 rolling weeks (oldest → newest).
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const hi = now - (7 - i) * 7 * DAY_MS + 7 * DAY_MS;
    const lo = hi - 7 * DAY_MS;
    return logged.filter((l) => {
      const t = new Date(l.date).getTime();
      return t >= lo && t < hi;
    }).length;
  });

  return {
    total: sent.length,
    flashes: flashes.length,
    attemptsTotal: logged.reduce((a, l) => a + (l.attempts ?? 1), 0),
    sessions: new Set(logged.map((l) => new Date(l.date).toDateString())).size,
    flashRate:
      sent.length > 0
        ? Math.round((100 * flashes.length) / sent.length)
        : null,
    thisWeek,
    lastWeek,
    topWall: mode(logged.map((l) => l.route.wall_section)),
    topColor: mode(logged.map((l) => l.route.hold_color)),
    streakWeeks,
    streakDays,
    pyramid,
    hardestSend: hardest(sent),
    hardestFlash: hardest(flashes),
    weeks,
  };
}

/** Hardest boulder + rope grades, kept separate so the UI can label each. */
export function hardestParts(
  h: { boulder: LoggedItem | null; toprope: LoggedItem | null },
  system: GradeSystem,
): { boulder: string | null; toprope: string | null } {
  return {
    boulder: h.boulder
      ? formatGradeStyled(
          h.boulder.ordinal,
          "boulder",
          system,
          h.boulder.route.gradingStyle,
        )
      : null,
    toprope: h.toprope
      ? formatGradeStyled(
          h.toprope.ordinal,
          "toprope",
          system,
          h.toprope.route.gradingStyle,
        )
      : null,
  };
}
