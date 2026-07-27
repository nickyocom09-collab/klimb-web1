const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
};

// High-confidence terms only. Short/ambiguous words use whole-word matching
// below so ordinary names such as Cassidy or Dickson are not rejected.
const BLOCKED_FRAGMENTS = [
  "fuck",
  "motherfuck",
  "shithead",
  "bullshit",
  "bitch",
  "cunt",
  "whore",
  "slut",
  "douche",
  "faggot",
  "nigger",
  "nigga",
  "retard",
  "kike",
  "chink",
  "spic",
];

const BLOCKED_WORDS = new Set([
  "ass",
  "dick",
  "cock",
  "pussy",
  "shit",
  "damn",
  "bastard",
]);

function normalizedParts(value: string): { compact: string; words: string[] } {
  const normalized = value
    .toLowerCase()
    .split("")
    .map((char) => LEET[char] ?? char)
    .join("")
    .replace(/(.)\1{2,}/g, "$1$1");
  return {
    compact: normalized.replace(/[^a-z]/g, ""),
    words: normalized.split(/[^a-z]+/).filter(Boolean),
  };
}

export function containsProfanity(value: string): boolean {
  const { compact, words } = normalizedParts(value);
  return (
    BLOCKED_FRAGMENTS.some((term) => compact.includes(term)) ||
    words.some((word) => BLOCKED_WORDS.has(word))
  );
}

export function profileNameError(
  displayName: string,
  username?: string,
): string | null {
  if (containsProfanity(displayName)) {
    return "Please choose a display name without profanity.";
  }
  if (username && containsProfanity(username)) {
    return "Please choose a username without profanity.";
  }
  return null;
}
