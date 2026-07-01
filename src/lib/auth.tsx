import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Database, UserRow } from "./database.types";
import { applyTheme } from "./theme";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

type AuthState = {
  session: Session | null;
  profile: UserRow | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

// --- Owner preview mode ----------------------------------------------------
// When VITE_PREVIEW=true in .env, the app skips login entirely and drops you
// straight into the feed as a read-only "Owner (Preview)" account. Great for
// just looking at the app. Writes (grading, adding routes) won't persist in
// this mode because there's no real signed-in user. Set VITE_PREVIEW=false
// (or remove it) to go back to normal email login.
const PREVIEW = import.meta.env.VITE_PREVIEW === "true";
const PREVIEW_GYM_ID = "a93c4592-8b55-4cca-8711-2bb75d07fe91"; // Austin Bouldering Project

function PreviewProvider({ children }: { children: ReactNode }) {
  const previewSession = {
    user: { id: "d0000000-0000-4000-8000-000000000001", email: "owner@klimb.app" },
  } as unknown as Session;
  const previewProfile: UserRow = {
    id: "d0000000-0000-4000-8000-000000000001",
    display_name: "Owner (Preview)",
    username: "owner",
    avatar_url: null,
    home_gym_id: PREVIEW_GYM_ID,
    visiting_gym_id: null,
    sends_public: true,
    grade_system: "american",
    theme: "dark",
    default_climb_filter: "all",
    onboarded: true,
    notifications_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  const value: AuthState = {
    session: previewSession,
    profile: previewProfile,
    loading: false,
    async signUp() {
      return { error: null, needsConfirmation: false };
    },
    async signIn() {
      return { error: null };
    },
    async signOut() {},
    async refreshProfile() {},
    async updateProfile() {
      return { error: null };
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (PREVIEW) return <PreviewProvider>{children}</PreviewProvider>;
  return <RealAuthProvider>{children}</RealAuthProvider>;
}

function RealAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingName = useRef<string | null>(null);
  const userId = session?.user.id ?? null;

  async function loadProfile(id: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  }

  async function ensureProfile(id: string, email: string) {
    let row = await loadProfile(id);
    if (!row) {
      const display = pendingName.current ?? email.split("@")[0] ?? "Climber";
      await supabase.from("profiles").insert({ id, display_name: display });
      pendingName.current = null;
      row = await loadProfile(id);
    }
    setProfile(row);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId || !session) {
      setProfile(null);
      return;
    }
    let active = true;
    setLoading(true);
    ensureProfile(userId, session.user.email ?? "").finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Keep the document theme in sync with the loaded profile preference.
  useEffect(() => {
    if (profile?.theme) applyTheme(profile.theme);
  }, [profile?.theme]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      async signUp(email, password, displayName) {
        pendingName.current = displayName.trim();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) return { error: error.message, needsConfirmation: false };
        const needsConfirmation = !data.session;
        return { error: null, needsConfirmation };
      },
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        return { error: error ? error.message : null };
      },
      async signOut() {
        await supabase.auth.signOut();
        setProfile(null);
      },
      async refreshProfile() {
        if (userId) setProfile(await loadProfile(userId));
      },
      async updateProfile(patch) {
        if (!userId) return { error: "Not signed in." };
        // Optimistically apply so the UI (and theme) react instantly.
        setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
        const { error } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", userId);
        if (error) {
          // Roll back to the persisted row on failure.
          setProfile(await loadProfile(userId));
          return { error: error.message };
        }
        return { error: null };
      },
    }),
    [session, profile, loading, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
