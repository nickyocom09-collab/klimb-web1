// Grade helpers across climbing types and grade systems.
//
// A grade is stored as an *ordinal index* into the route's climbing-type scale:
//   boulder  -> 0..17  (V0..V17)
//   toprope  -> 0..28  (5.5..5.15d)
// The same ordinal renders in either grade system (American / European) by
// indexing into the matching, index-aligned label array below. This is the
// "mapping table" between American and European grades — every stored ordinal
// has a label in both systems, so community grades display correctly in both
// regardless of which scale they were submitted on.

export type ClimbingType = "boulder" | "toprope";
export type GradeSystem = "american" | "european";

// --- Boulder ---------------------------------------------------------------
// American: Hueco V-scale.
const BOULDER_AMERICAN = Array.from({ length: 18 }, (_, i) => `V${i}`); // V0..V17
// European: Fontainebleau, curated to align 1:1 with V0..V17.
const BOULDER_EUROPEAN = [
  "4", "5", "5+", "6A", "6B", "6C", "7A", "7A+", "7B", "7C",
  "7C+", "8A", "8A+", "8B", "8B+", "8C", "8C+", "9A",
];

// --- Top rope --------------------------------------------------------------
// American: Yosemite Decimal System.
const TOPROPE_AMERICAN = [
  "5.5", "5.6", "5.7", "5.8", "5.9",
  "5.10a", "5.10b", "5.10c", "5.10d",
  "5.11a", "5.11b", "5.11c", "5.11d",
  "5.12a", "5.12b", "5.12c", "5.12d",
  "5.13a", "5.13b", "5.13c", "5.13d",
  "5.14a", "5.14b", "5.14c", "5.14d",
  "5.15a", "5.15b", "5.15c", "5.15d",
];
// European: French sport grades, index-aligned 1:1 with the YDS list above.
const TOPROPE_EUROPEAN = [
  "3", "4", "4+", "5a", "5b",
  "5c", "6a", "6a+", "6b", "6b+",
  "6c", "6c+", "7a", "7a+", "7b",
  "7b+", "7c", "7c+", "8a", "8a+",
  "8b", "8b+", "8c", "8c+", "9a",
  "9a+", "9b", "9b+", "9c",
];

const SCALES: Record<
  ClimbingType,
  Record<GradeSystem, string[]>
> = {
  boulder: { american: BOULDER_AMERICAN, european: BOULDER_EUROPEAN },
  toprope: { american: TOPROPE_AMERICAN, european: TOPROPE_EUROPEAN },
};

/** Ordinal indices [0..n-1] available for a climbing type. */
export function gradeOrdinals(type: ClimbingType): number[] {
  return SCALES[type].american.map((_, i) => i);
}

/** The label array for a type + system (index = stored ordinal). */
export function gradeLabels(
  type: ClimbingType,
  system: GradeSystem,
): string[] {
  return SCALES[type][system];
}

/** Render a stored ordinal as a label in the given type + system. */
export function formatGrade(
  grade: number | null | undefined,
  type: ClimbingType = "boulder",
  system: GradeSystem = "american",
): string {
  if (grade === null || grade === undefined || Number.isNaN(grade)) return "—";
  const labels = SCALES[type][system];
  const i = Math.round(grade);
  return labels[i] ?? "—";
}

/**
 * Community grade = MEDIAN of submitted ordinals (matches the DB trigger).
 * A median shrugs off a single sandbagged or trolled vote, where the old
 * average would drift. Null when nobody has graded.
 */
export function communityGrade(grades: number[]): number | null {
  if (grades.length === 0) return null;
  const sorted = [...grades].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Build a distribution count map over the populated ordinal range. */
export function gradeDistribution(grades: number[]): {
  grade: number;
  count: number;
}[] {
  if (grades.length === 0) return [];
  const counts = new Map<number, number>();
  for (const g of grades) counts.set(g, (counts.get(g) ?? 0) + 1);
  const min = Math.min(...grades);
  const max = Math.max(...grades);
  const out: { grade: number; count: number }[] = [];
  for (let g = min; g <= max; g++)
    out.push({ grade: g, count: counts.get(g) ?? 0 });
  return out;
}

/** Sample standard deviation — used to decide tight vs. wide spread coloring. */
export function gradeSpread(grades: number[]): number {
  if (grades.length < 2) return 0;
  const mean = grades.reduce((a, b) => a + b, 0) / grades.length;
  const variance =
    grades.reduce((a, b) => a + (b - mean) ** 2, 0) / (grades.length - 1);
  return Math.sqrt(variance);
}

/** Tight consensus -> accent green; wide disagreement -> orange. */
export function spreadColor(grades: number[]): string {
  return gradeSpread(grades) <= 1 ? "#39FF88" : "#FF9F45";
}

// --- Gym grading styles ------------------------------------------------------
// Every gym grades differently. Klimb stores fine-grained ordinals either way,
// but *displays* them in the gym's own house style:
//   classic -> full V-scale / YDS letters (default everywhere)
//   bands   -> Climb Bentonville (pilot gym): boulders graded in bands
//              (V0-V2 / V3-V5 / V6-V8 / V8+) and ropes with -/+ instead of
//              letters (5.9- is easier than 5.9, which is easier than 5.9+).
export type GradeStyle = "classic" | "bands";

const BOULDER_BANDS: { label: string; min: number; max: number; rep: number }[] =
  [
    { label: "V0-V2", min: 0, max: 2, rep: 1 },
    { label: "V3-V5", min: 3, max: 5, rep: 4 },
    { label: "V6-V8", min: 6, max: 8, rep: 7 },
    { label: "V8+", min: 9, max: 17, rep: 10 },
  ];

function boulderBandLabel(g: number): string {
  const band = BOULDER_BANDS.find((b) => g >= b.min && g <= b.max);
  return band?.label ?? "V8+";
}

/** "5.10a" -> "5.10-", "5.10b" -> "5.10", "5.10c"/"5.10d" -> "5.10+". */
function topropeBandLabel(g: number): string {
  const yds = TOPROPE_AMERICAN[g];
  if (!yds) return "—";
  const m = yds.match(/^(5\.\d+)([a-d])$/);
  if (!m) return yds; // 5.5..5.9 have no letters
  const [, base, letter] = m;
  if (letter === "a") return `${base}-`;
  if (letter === "b") return `${base}`;
  return `${base}+`;
}

/** Format a stored ordinal in the gym's grading style. */
export function formatGradeStyled(
  grade: number | null | undefined,
  type: ClimbingType,
  system: GradeSystem,
  style: GradeStyle = "classic",
): string {
  if (grade === null || grade === undefined || Number.isNaN(grade)) return "—";
  if (style !== "bands") return formatGrade(grade, type, system);
  const i = Math.round(grade);
  return type === "boulder" ? boulderBandLabel(i) : topropeBandLabel(i);
}

/** Selectable grades for a picker, respecting the gym's grading style. */
export function pickerOptions(
  type: ClimbingType,
  system: GradeSystem,
  style: GradeStyle = "classic",
): { value: number; label: string }[] {
  if (style !== "bands") {
    const labels = gradeLabels(type, system);
    return labels.map((label, value) => ({ value, label }));
  }
  if (type === "boulder") {
    return BOULDER_BANDS.map((b) => ({ value: b.rep, label: b.label }));
  }
  // Top rope bands: 5.5..5.9 plain, then -, plain, + for each number grade.
  // -/plain/+ store as the a/b/c ordinals so averages stay comparable.
  const out: { value: number; label: string }[] = [];
  for (let g = 0; g < TOPROPE_AMERICAN.length; g++) {
    const label = topropeBandLabel(g);
    if (TOPROPE_AMERICAN[g].endsWith("d")) continue; // fold d into +
    out.push({ value: g, label });
  }
  return out;
}

/** Group ordinals into display buckets for distributions (band-aware). */
export function distributionBuckets(
  grades: number[],
  type: ClimbingType,
  system: GradeSystem,
  style: GradeStyle = "classic",
): { label: string; count: number }[] {
  if (grades.length === 0) return [];
  const counts = new Map<string, number>();
  const order: string[] = [];
  const min = Math.min(...grades);
  const max = Math.max(...grades);
  for (let g = min; g <= max; g++) {
    const label = formatGradeStyled(g, type, system, style);
    if (!counts.has(label)) {
      counts.set(label, 0);
      order.push(label);
    }
  }
  for (const g of grades) {
    const label = formatGradeStyled(g, type, system, style);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return order.map((label) => ({ label, count: counts.get(label) ?? 0 }));
}

export type ConsensusTone = "green" | "orange" | "none";

/**
 * The community "verdict" for a route: how much the crowd agrees.
 * - none: 0 or 1 grades (nothing to agree on yet)
 * - green: tight spread → strong consensus
 * - orange: wide spread → contested
 */
export function gradeConsensus(grades: number[]): {
  tone: ConsensusTone;
  spread: number;
  min: number | null;
  max: number | null;
  count: number;
} {
  const count = grades.length;
  if (count === 0)
    return { tone: "none", spread: 0, min: null, max: null, count };
  const spread = gradeSpread(grades);
  const min = Math.min(...grades);
  const max = Math.max(...grades);
  const tone: ConsensusTone =
    count < 2 ? "none" : spread <= 1 ? "green" : "orange";
  return { tone, spread, min, max, count };
}
