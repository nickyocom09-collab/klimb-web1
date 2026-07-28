import { supabase } from "./supabase";
import type { GymRow } from "./database.types";

// PostgREST/Supabase projects commonly cap a single response at 1,000 rows.
// Keep the directory complete as the gym catalogue grows, rather than quietly
// dropping countries from pickers, passports, searches, or the map.
const DIRECTORY_PAGE_SIZE = 500;

type GymLocation = Pick<GymRow, "city" | "state" | "country" | "cc">;

function clean(value: string | null | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

function normalized(value: string | null | undefined): string {
  return (clean(value) ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * A short, human-readable location for every gym card.  Imported listings do
 * not always include a city, so fall back through state and country rather
 * than rendering an unexplained blank row.
 */
export function gymLocationLabel(gym: GymLocation): string {
  const city = clean(gym.city);
  const state = clean(gym.state);
  const country = clean(gym.country);
  const unique = (values: Array<string | null>) =>
    values.filter(
      (value, index, all): value is string =>
        Boolean(value) &&
        all.findIndex((candidate) => normalized(candidate) === normalized(value)) === index,
    );

  if (city && state) return unique([city, state]).join(", ");
  if (city) return unique([city, country]).join(", ");
  if (state) return unique([state, country]).join(", ");
  return country ?? "Location not listed";
}

function directoryKey(gym: GymRow): string {
  const name = normalized(gym.name);
  if (gym.latitude !== null && gym.longitude !== null) {
    // Three decimal places is roughly 110 m: close enough to merge imported
    // copies of the same building, while keeping different branches separate.
    return `${name}|${gym.latitude.toFixed(3)}|${gym.longitude.toFixed(3)}`;
  }
  return `${name}|${normalized(gym.city)}|${normalized(gym.state)}|${normalized(gym.country)}`;
}

function gymCompleteness(gym: GymRow): number {
  return [gym.city, gym.state, gym.country, gym.latitude, gym.longitude].filter(
    (value) => value !== null && value !== "",
  ).length;
}

/** Keep one rich, stable copy of an otherwise duplicated physical location. */
export function dedupeGymDirectory(gyms: GymRow[]): GymRow[] {
  const byLocation = new Map<string, GymRow>();

  for (const gym of gyms) {
    const key = directoryKey(gym);
    const existing = byLocation.get(key);
    if (!existing || gymCompleteness(gym) > gymCompleteness(existing)) {
      byLocation.set(key, gym);
    }
  }

  return [...byLocation.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

/** Fetch the complete public Klimb gym directory in a stable order. */
export async function fetchApprovedGyms(): Promise<GymRow[]> {
  const gyms: GymRow[] = [];

  for (let from = 0; ; from += DIRECTORY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("gyms")
      .select("*")
      .eq("status", "approved")
      .order("name")
      .order("id")
      .range(from, from + DIRECTORY_PAGE_SIZE - 1);

    if (error) throw error;

    const page = data ?? [];
    gyms.push(...page);
    if (page.length < DIRECTORY_PAGE_SIZE) return dedupeGymDirectory(gyms);
  }
}
