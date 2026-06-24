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

/** Average of submitted ordinals, rounded to nearest integer. Null when none. */
export function communityGrade(grades: number[]): number | null {
  if (grades.length === 0) return null;
  const sum = grades.reduce((a, b) => a + b, 0);
  return Math.round(sum / grades.length);
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
