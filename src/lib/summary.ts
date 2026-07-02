// Auto-generated route summary: turns the route's grades, fun ratings, and
// comment chatter into a couple of readable sentences. Runs entirely on the
// client — no API round-trip — so it's instant and free.

import {
  communityGrade,
  formatGrade,
  gradeConsensus,
  type ClimbingType,
  type GradeSystem,
} from "./grades";

// Climbing vocabulary worth surfacing from comments, mapped to display terms.
const TOPICS: { pattern: RegExp; label: string }[] = [
  { pattern: /crimp/i, label: "crimps" },
  { pattern: /sloper/i, label: "slopers" },
  { pattern: /jug/i, label: "jugs" },
  { pattern: /pinch/i, label: "pinches" },
  { pattern: /dyno|jump/i, label: "the dyno" },
  { pattern: /heel\s*hook/i, label: "the heel hook" },
  { pattern: /toe\s*hook/i, label: "the toe hook" },
  { pattern: /mantle|top\s*out/i, label: "the top-out" },
  { pattern: /reach|tall|short/i, label: "reach" },
  { pattern: /pump/i, label: "the pump" },
  { pattern: /balance|balanc/i, label: "balance" },
  { pattern: /compress/i, label: "compression" },
  { pattern: /gaston/i, label: "the gaston" },
  { pattern: /undercling/i, label: "the undercling" },
  { pattern: /sit\s*start/i, label: "the sit start" },
  { pattern: /sandbag|stiff/i, label: "sandbagging" },
  { pattern: /soft|easy for/i, label: "feeling soft" },
];

export function routeSummary(input: {
  gradeValues: number[];
  gymGrade: number | null;
  climbingType: ClimbingType;
  system: GradeSystem;
  funAvg: number | null;
  funCount: number;
  sendCount: number;
  comments: { body: string; is_beta: boolean }[];
}): string {
  const {
    gradeValues,
    gymGrade,
    climbingType,
    system,
    funAvg,
    funCount,
    sendCount,
    comments,
  } = input;
  const parts: string[] = [];
  const fmt = (g: number | null) => formatGrade(g, climbingType, system);
  const { tone, min, max, count } = gradeConsensus(gradeValues);
  const community = communityGrade(gradeValues);

  // Grade story
  if (count === 0) {
    parts.push("No grade opinions yet — be the first to weigh in.");
  } else if (count === 1) {
    parts.push(`Only one vote so far, calling it ${fmt(community)}.`);
  } else if (tone === "green") {
    parts.push(
      `${count} climbers largely agree this feels like ${fmt(community)}.`,
    );
  } else {
    parts.push(
      `The grade is contested — ${count} votes ranging from ${fmt(min)} to ${fmt(max)}, settling around ${fmt(community)}.`,
    );
  }

  // Community vs. gym
  if (community !== null && gymGrade !== null && gymGrade !== undefined) {
    if (community > gymGrade)
      parts.push(`Most feel it climbs stiffer than the gym's ${fmt(gymGrade)}.`);
    else if (community < gymGrade)
      parts.push(`Most feel it climbs softer than the gym's ${fmt(gymGrade)}.`);
    else parts.push(`The crowd backs the gym's ${fmt(gymGrade)}.`);
  }

  // Fun factor
  if (funCount > 0 && funAvg !== null) {
    if (funAvg >= 4.5) parts.push("It's rated an absolute crowd-pleaser.");
    else if (funAvg >= 3.8) parts.push("Climbers are having a great time on it.");
    else if (funAvg >= 3) parts.push("Fun ratings are decent but not glowing.");
    else parts.push("Fun ratings are lukewarm — style points are in dispute.");
  }

  // What people are talking about
  const seen = new Set<string>();
  for (const c of comments) {
    for (const t of TOPICS) {
      if (seen.size >= 2) break;
      if (t.pattern.test(c.body)) seen.add(t.label);
    }
  }
  if (seen.size > 0) {
    parts.push(`Comment chatter centers on ${[...seen].join(" and ")}.`);
  }

  const betaCount = comments.filter((c) => c.is_beta).length;
  if (betaCount > 0) {
    parts.push(
      `${betaCount} beta tip${betaCount === 1 ? " is" : "s are"} hiding in the comments.`,
    );
  } else if (sendCount > 0 && parts.length < 3) {
    parts.push(
      `${sendCount} send${sendCount === 1 ? "" : "s"} logged so far.`,
    );
  }

  return parts.slice(0, 4).join(" ");
}
