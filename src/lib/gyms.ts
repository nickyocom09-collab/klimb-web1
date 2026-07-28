import { supabase } from "./supabase";
import type { GymRow } from "./database.types";

// PostgREST/Supabase projects commonly cap a single response at 1,000 rows.
// Keep the directory complete as the gym catalogue grows, rather than quietly
// dropping countries from pickers, passports, searches, or the map.
const DIRECTORY_PAGE_SIZE = 500;

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
    if (page.length < DIRECTORY_PAGE_SIZE) return gyms;
  }
}
