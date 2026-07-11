// Klimb's playful "route intelligence." Until real climbers pile in, the AI
// vouches for your grade: a deterministic, route-seeded consensus so the app
// feels alive at one user. Same route → same numbers, always (no flicker).
// When real votes exist (2+), the UI should prefer those.

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type AiConsensus = {
  /** How many (pretend) climbers weighed in. 3–9. */
  climbers: number;
  /** How many of them agree with the logged grade. */
  agree: number;
  /** One-line verdict for display. */
  line: string;
};

/**
 * Deterministic pseudo-consensus for a route. Seeded by route id so it never
 * changes between visits. `gradeLabel` is whatever grade we're vouching for.
 */
export function aiConsensus(routeId: string, gradeLabel: string): AiConsensus {
  const h = hash(routeId);
  const climbers = 3 + (h % 7); // 3..9
  const dissent = (h >> 3) % 2 === 0 ? 0 : 1; // most agree; sometimes one holdout
  const agree = Math.max(2, climbers - dissent);
  const line =
    dissent === 0
      ? `${climbers} climbers agree — feels like ${gradeLabel}.`
      : `${agree} of ${climbers} climbers agree it's ${gradeLabel} — one says it's stiffer.`;
  return { climbers, agree, line };
}
