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
import { authRedirectUrl } from "./deeplink";
import { AppleSignIn, canUseNativeAppleSignIn } from "./appleSignIn";

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
  /** Kick off an OAuth redirect (Google / Apple). Resolves before redirect. */
  signInWithProvider: (
    provider: "google" | "apple",
  ) => Promise<{ error: string | null }>;
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
    bio: null,
    home_gym_id: PREVIEW_GYM_ID,
    visiting_gym_id: null,
    sends_public: true,
    grade_system: "american",
    theme: "dark",
    default_climb_filter: "all",
    onboarded: true,
    seen_intro: true,
    notifications_seen_at: new Date().toISOString(),
    notifications_cleared_at: null,
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
    async signInWithProvider() {
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
  // Hold the branded splash for a beat on cold start — auth usually resolves
  // in ~100ms, which made the logo flash instead of land.
  const [bootHold, setBootHold] = useState(true);
  const pendingName = useRef<string | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    const t = setTimeout(() => setBootHold(false), 1500);
    return () => clearTimeout(t);
  }, []);

  async function loadProfile(id: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  }

  async function ensureProfile(user: Session["user"]) {
    let row = await loadProfile(user.id);
    if (!row) {
      // OAuth providers hand us a name/avatar — use them for a nicer default
      // than the email prefix. Email signup still uses the typed display name.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const metaName =
        (meta.full_name as string) ||
        (meta.name as string) ||
        (meta.user_name as string) ||
        null;
      const display =
        pendingName.current ??
        metaName ??
        user.email?.split("@")[0] ??
        "Climber";
      const avatar =
        (meta.avatar_url as string) || (meta.picture as string) || null;
      await supabase
        .from("profiles")
        .insert({ id: user.id, display_name: display, avatar_url: avatar });
      pendingName.current = null;
      row = await loadProfile(user.id);
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
    ensureProfile(session.user).finally(() => {
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
      loading: loading || bootHold,
      async signUp(email, password, displayName) {
        pendingName.current = displayName.trim();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) return { error: error.message, needsConfirmation: false };
        // Supabase doesn't return an error for a duplicate, already-confirmed
        // email (it avoids leaking which emails exist) — instead it returns a
        // user with no new identity attached. That's the signal to catch it.
        if (data.user && data.user.identities?.length === 0) {
          return {
            error: "An account with this email already exists. Try logging in instead.",
            needsConfirmation: false,
          };
        }
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
      async signInWithProvider(provider) {
        // Apple on iOS: run the whole flow in the native system sheet (no
        // browser bounce) and hand the identity token straight to Supabase.
        if (provider === "apple" && canUseNativeAppleSignIn()) {
          try {
            const { identityToken, nonce } = await AppleSignIn.signIn();
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "apple",
              token: identityToken,
              nonce,
            });
            return { error: error ? error.message : null };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message === "CANCELED") return { error: null };
            return { error: message };
          }
        }
        // Everyone else (Google, and Apple on web): OAuth is a full-page
        // redirect; on return, onAuthStateChange picks up the session and
        // ensureProfile creates the profile if it's new.
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: authRedirectUrl() },
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
    [session, profile, loading, bootHold, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
