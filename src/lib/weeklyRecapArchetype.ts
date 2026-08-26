import type { RecapPayload } from "./database.types";

export type RecapArchetype = {
  key: string;
  label: string;
  sub: string;
  hue: string;
};

const ARCHETYPES: RecapArchetype[] = [
  { key: "breakthrough", label: "Breakthrough", sub: "You sent a new personal best.", hue: "#4ADE80" },
  { key: "grind", label: "The Grind", sub: "More time on the wall than ever.", hue: "#7CC5FF" },
  { key: "project", label: "Project Hunter", sub: "You threw yourself at one line, again and again.", hue: "#E4B363" },
  { key: "flash", label: "Flash Machine", sub: "First try, first send — over and over.", hue: "#FFD166" },
  { key: "comeback", label: "Comeback Kid", sub: "You came back stronger.", hue: "#4ADE80" },
  { key: "endurance", label: "Endurance Beast", sub: "You just wouldn't come down.", hue: "#5EEAD4" },
  { key: "technician", label: "The Technician", sub: "Precision over power all week.", hue: "#A5B4FC" },
  { key: "power", label: "Power House", sub: "Steep, savage, and sent.", hue: "#F87171" },
  { key: "metronome", label: "Metronome", sub: "You showed up day after day.", hue: "#4ADE80" },
  { key: "plateau", label: "Plateau Breaker", sub: "You cracked the grade that's been haunting you.", hue: "#4ADE80" },
  { key: "fresh", label: "Fresh Chalk", sub: "Welcome. Week one is in the books.", hue: "#94E2C4" },
  { key: "ember", label: "Ember Keeper", sub: "You kept the streak alive.", hue: "#FB923C" },
  { key: "steady", label: "Steady Hands", sub: "You showed up and put the work in.", hue: "#8EE6C8" },
];

const PRIORITY = new Map(
  ARCHETYPES.map((archetype, index) => [archetype.key, index]),
);

/**
 * Selects recap copy from recorded recap stats only. Score ties use the fixed
 * priority above, so the same payload always returns the same result.
 */
export function archetypeFor(p: RecapPayload): RecapArchetype {
  const byKey = (key: string) =>
    ARCHETYPES.find((archetype) => archetype.key === key) ??
    ARCHETYPES[ARCHETYPES.length - 1];
  const wall = (p.top_wall ?? "").toLowerCase();
  const ratio = p.climbs > 0 ? p.attempts / p.climbs : 0;
  const noPreviousActivity = p.prev.climbs === 0 && p.prev.sends === 0;
  const returningAfterGap =
    noPreviousActivity &&
    p.oldest_project_days !== null &&
    p.oldest_project_days >= 7;
  const firstActivePeriod = noPreviousActivity && !returningAfterGap;
  const flashRate = p.flash_rate ?? 0;
  const gradeBreadth = new Set(
    p.pyramid.map((row) => `${row.type}:${row.ordinal}`),
  ).size;
  const bothDisciplines =
    p.hardest_send.boulder !== null && p.hardest_send.toprope !== null;

  const scores: [string, number][] = [];

  if (firstActivePeriod && p.climbs > 0) scores.push(["fresh", 88]);
  if (returningAfterGap && p.climbs > 0) scores.push(["comeback", 82]);
  if (!firstActivePeriod && p.new_grades.length > 0) {
    const isLongProject =
      p.oldest_project_days !== null && p.oldest_project_days >= 21;
    scores.push([
      isLongProject ? "plateau" : "breakthrough",
      (isLongProject ? 76 : 62) + Math.min(p.new_grades.length * 3, 9),
    ]);
  }

  if (flashRate >= 50 && p.flashes >= 3)
    scores.push(["flash", 40 + flashRate / 2]);
  if (ratio >= 2.5 && p.attempts >= 10)
    scores.push(["project", 40 + Math.min(ratio * 6, 30)]);
  if (wall.includes("overhang") || wall.includes("cave") || wall.includes("roof"))
    scores.push(["power", 55]);
  if (wall.includes("slab") || (flashRate >= 40 && ratio <= 1.5 && p.sends >= 4))
    scores.push(["technician", 52]);
  if (p.attempts >= 25 || p.climbs >= 20)
    scores.push(["endurance", 40 + Math.min(p.attempts / 2, 25)]);
  if (p.sessions >= 4) scores.push(["metronome", 42 + p.sessions * 3]);
  if (p.streak >= 3) scores.push(["ember", 38 + Math.min(p.streak * 3, 24)]);
  if (bothDisciplines || gradeBreadth >= 6) scores.push(["steady", 46]);
  if (p.prev.climbs > 0 && p.climbs >= p.prev.climbs * 1.4)
    scores.push(["grind", 50]);
  if (scores.length === 0) scores.push(["steady", 10]);

  scores.sort(
    (a, b) =>
      b[1] - a[1] ||
      (PRIORITY.get(a[0]) ?? Number.MAX_SAFE_INTEGER) -
        (PRIORITY.get(b[0]) ?? Number.MAX_SAFE_INTEGER),
  );

  const chosen = byKey(scores[0][0]);
  const evidence: Record<string, string> = {
    fresh: `${p.climbs} climb${p.climbs === 1 ? "" : "s"} in your first active recap.`,
    comeback: `${p.climbs} climb${p.climbs === 1 ? "" : "s"} after a quiet previous period.`,
    plateau: `${p.new_grades.length} new grade${p.new_grades.length === 1 ? "" : "s"} unlocked on a long-running project.`,
    breakthrough: `${p.new_grades.length} new grade${p.new_grades.length === 1 ? "" : "s"} unlocked.`,
    flash: `${p.flashes} flashes and a ${Math.round(flashRate)}% flash rate.`,
    project: `${p.attempts} attempts across ${p.climbs} Klimb${p.climbs === 1 ? "" : "s"}.`,
    power: `${p.top_wall ?? "Steep terrain"} was your most-climbed wall style.`,
    technician: `${p.sends} sends with a ${Math.round(flashRate)}% flash rate.`,
    endurance: `${p.attempts} attempts across ${p.sessions} session${p.sessions === 1 ? "" : "s"}.`,
    metronome: `${p.sessions} separate climbing sessions.`,
    ember: `${p.streak} active week${p.streak === 1 ? "" : "s"} in your streak.`,
    grind: `${p.climbs} Klimb${p.climbs === 1 ? "" : "s"}, up from ${p.prev.climbs} last period.`,
    steady: `${p.climbs} Klimb${p.climbs === 1 ? "" : "s"} across ${p.sessions} session${p.sessions === 1 ? "" : "s"}.`,
  };

  return { ...chosen, sub: evidence[chosen.key] ?? chosen.sub };
}
