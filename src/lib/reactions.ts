export const REACTION_PRESETS = ["🔥", "💪", "👏", "🤯", "🧗", "💯", "⚡️", "🤩", "😮‍💨", "🫡"] as const;

export type ReactionCounts = Record<string, number>;

export function normalizeStoredReaction(reaction: string): string {
  if (reaction === "clap") return "👏";
  if (reaction === "fire") return "🔥";
  if (reaction === "strong") return "💪";
  return reaction;
}
