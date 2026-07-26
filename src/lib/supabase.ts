import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Klimb] Missing Supabase env vars. Set VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY in your .env file, then restart the dev server.",
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // PKCE is the reliable flow for mobile deep-link OAuth: the provider
      // returns a short `?code=` (which our deep-link handler exchanges for a
      // session) instead of a long #hash fragment that custom URL schemes
      // deliver unreliably. This is what makes Google/Apple OAuth complete on
      // device instead of spinning forever.
      flowType: "pkce",
    },
  },
);
