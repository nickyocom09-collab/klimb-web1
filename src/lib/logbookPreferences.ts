import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export type LogbookPreferences = {
  show_photo: boolean;
  show_video: boolean;
  show_hold_color: boolean;
  show_gym_grade: boolean;
  show_felt_grade: boolean;
  show_quality: boolean;
  show_route_name: boolean;
  show_note: boolean;
  show_profile_visibility: boolean;
  default_profile_visible: boolean;
};

export const DEFAULT_LOGBOOK_PREFERENCES: LogbookPreferences = {
  show_photo: true,
  show_video: true,
  show_hold_color: true,
  show_gym_grade: true,
  show_felt_grade: true,
  show_quality: true,
  show_route_name: true,
  show_note: true,
  show_profile_visibility: true,
  default_profile_visible: true,
};

export const LOGBOOK_PRESETS: Record<string, LogbookPreferences> = {
  Full: DEFAULT_LOGBOOK_PREFERENCES,
  Quick: {
    ...DEFAULT_LOGBOOK_PREFERENCES,
    show_photo: false,
    show_video: false,
    show_gym_grade: false,
    show_felt_grade: false,
    show_quality: false,
    show_route_name: false,
    show_note: false,
  },
  Training: {
    ...DEFAULT_LOGBOOK_PREFERENCES,
    show_photo: false,
    show_video: false,
    show_route_name: false,
    show_profile_visibility: false,
    default_profile_visible: false,
  },
};

export function useLogbookPreferences() {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const [preferences, setPreferences] = useState(DEFAULT_LOGBOOK_PREFERENCES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPreferences(DEFAULT_LOGBOOK_PREFERENCES);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("logbook_preferences")
      .select("show_photo, show_video, show_hold_color, show_gym_grade, show_felt_grade, show_quality, show_route_name, show_note, show_profile_visibility, default_profile_visible")
      .eq("user_id", userId)
      .maybeSingle();
    setPreferences(data ? { ...DEFAULT_LOGBOOK_PREFERENCES, ...data } : DEFAULT_LOGBOOK_PREFERENCES);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (next: LogbookPreferences) => {
    if (!userId) return { error: new Error("You need to be signed in.") };
    const previous = preferences;
    setPreferences(next);
    const { error } = await supabase.from("logbook_preferences").upsert({
      user_id: userId,
      ...next,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) setPreferences(previous);
    return { error };
  }, [preferences, userId]);

  return { preferences, loading, save, refresh };
}
