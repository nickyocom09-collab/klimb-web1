type SearchableGym = {
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  cc?: string | null;
  brand?: string | null;
};

/** Accent-, punctuation-, and spacing-insensitive matching for gym search. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchesGymSearch(gym: SearchableGym, query: string): boolean {
  const q = normalize(query);
  if (!q) return false;

  const haystack = normalize(
    [gym.name, gym.city, gym.state, gym.country, gym.cc, gym.brand]
      .filter(Boolean)
      .join(" "),
  );

  return (
    haystack.includes(q) ||
    haystack.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
    q.split(" ").every((token) => haystack.includes(token))
  );
}
