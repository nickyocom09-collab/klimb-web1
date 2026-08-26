import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type PermissionStatus,
  type Token,
} from "@capacitor/push-notifications";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import type { Database } from "./database.types";
import { notificationDestination } from "./notificationDestination";

export type NotificationPreferences =
  Database["public"]["Tables"]["notification_preferences"]["Row"];
export type NotificationPreferenceKey =
  | "friend_requests"
  | "friend_accepts"
  | "weekly_recaps"
  | "streak_risk"
  | "inactivity";

type PushState = {
  available: boolean;
  permission: PermissionStatus["receive"] | "unavailable";
  active: boolean;
  preferences: NotificationPreferences | null;
  error: string | null;
  enable: () => Promise<{ error: string | null }>;
  disable: () => Promise<{ error: string | null }>;
  updatePreference: (
    key: NotificationPreferenceKey,
    value: boolean,
  ) => Promise<{ error: string | null }>;
  setAllPreferences: (value: boolean) => Promise<{ error: string | null }>;
};

const PushContext = createContext<PushState | undefined>(undefined);
const isNativeIos =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function PushNotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id ?? null;
  const [permission, setPermission] = useState<
    PermissionStatus["receive"] | "unavailable"
  >(isNativeIos ? "prompt" : "unavailable");
  const [active, setActive] = useState(false);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enableDefaultsOnRegistration = useRef(false);

  const storeToken = useCallback(
    async (token: Token) => {
      if (!userId) return;
      const { error: registrationError } = await supabase.rpc(
        "register_push_token",
        {
          p_token: token.value,
          p_timezone: deviceTimezone(),
          // TestFlight and App Store builds use the production APNs environment.
          p_environment: "production",
        },
      );
      if (registrationError) throw registrationError;
      const { data: preferenceRow } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      let resolvedPreferences = preferenceRow as NotificationPreferences | null;
      if (enableDefaultsOnRegistration.current && resolvedPreferences) {
        enableDefaultsOnRegistration.current = false;
        const { data: updatedPreferences, error: defaultsError } = await supabase
          .from("notification_preferences")
          .update({
            friend_requests: true,
            friend_accepts: true,
            weekly_recaps: true,
            streak_risk: true,
            inactivity: true,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select("*")
          .single();
        if (defaultsError) throw defaultsError;
        resolvedPreferences = updatedPreferences as NotificationPreferences;
      }
      setPreferences(resolvedPreferences);
      setActive(true);
      setError(null);
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    if (!isNativeIos || !userId) {
      setActive(false);
      setPreferences(null);
      return;
    }
    const [permissionResult, preferencesResult, tokensResult] =
      await Promise.all([
        PushNotifications.checkPermissions(),
        supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("push_tokens")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("enabled", true),
      ]);
    setPermission(permissionResult.receive);
    setPreferences(preferencesResult.data as NotificationPreferences | null);
    setActive(
      permissionResult.receive === "granted" && (tokensResult.count ?? 0) > 0,
    );
  }, [userId]);

  useEffect(() => {
    if (!isNativeIos || !userId) return;
    let cancelled = false;
    const handles: { remove: () => Promise<void> }[] = [];
    const addListeners = async () => {
      const registration = await PushNotifications.addListener(
        "registration",
        (token) => {
          void storeToken(token).catch((registrationError: unknown) => {
            if (!cancelled) {
              setError(
                registrationError instanceof Error
                  ? registrationError.message
                  : "Couldn't register this device for notifications.",
              );
            }
          });
        },
      );
      if (cancelled) await registration.remove();
      else handles.push(registration);

      const registrationError = await PushNotifications.addListener(
        "registrationError",
        (event) => {
          if (!cancelled) setError(event.error);
        },
      );
      if (cancelled) await registrationError.remove();
      else handles.push(registrationError);

      const received = await PushNotifications.addListener(
        "pushNotificationReceived",
        () => window.dispatchEvent(new CustomEvent("klimb:push-received")),
      );
      if (cancelled) await received.remove();
      else handles.push(received);

      const action = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (event) => {
          navigate(notificationDestination(event.notification.data?.link));
        },
      );
      if (cancelled) await action.remove();
      else handles.push(action);

      const status = await PushNotifications.checkPermissions();
      if (!cancelled) setPermission(status.receive);
      if (status.receive === "granted") await PushNotifications.register();
    };
    void addListeners();
    void refresh();
    return () => {
      cancelled = true;
      for (const handle of handles) void handle.remove();
    };
  }, [navigate, refresh, storeToken, userId]);

  const enable = useCallback(async (): Promise<{ error: string | null }> => {
    if (!isNativeIos)
      return { error: "Push notifications require the iOS app." };
    try {
      setError(null);
      let status = await PushNotifications.checkPermissions();
      if (
        status.receive === "prompt" ||
        status.receive === "prompt-with-rationale"
      ) {
        status = await PushNotifications.requestPermissions();
      }
      setPermission(status.receive);
      if (status.receive !== "granted") {
        const message =
          "Notifications are off. Enable them for Klimb in the iPhone Settings app.";
        setError(message);
        return { error: message };
      }
      // A master-level enable always starts from the useful default: every
      // category is on. Fine-grained changes remain available in Settings.
      enableDefaultsOnRegistration.current = true;
      await PushNotifications.register();
      return { error: null };
    } catch (enableError) {
      const message =
        enableError instanceof Error
          ? enableError.message
          : "Couldn't enable notifications.";
      setError(message);
      return { error: message };
    }
  }, []);

  // Notifications default on for the next build. iOS still owns the system
  // permission—the app can request it once, but can never bypass a denial.
  // A per-account marker prevents repeated prompts across normal launches.
  useEffect(() => {
    if (!isNativeIos || !userId) return;
    const marker = `klimb.push.auto-requested:${userId}`;
    try {
      if (localStorage.getItem(marker)) return;
    } catch {
      // Storage being unavailable should not prevent registration.
    }
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(marker, "1");
      } catch {
        // Best effort only.
      }
      void enable();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [enable, userId]);

  const disable = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      const { error: disableError } = await supabase.rpc(
        "disable_all_push_tokens",
      );
      if (disableError) throw disableError;
      if (isNativeIos) await PushNotifications.unregister();
      setActive(false);
      setError(null);
      return { error: null };
    } catch (disableError) {
      const message =
        disableError instanceof Error
          ? disableError.message
          : "Couldn't disable notifications.";
      setError(message);
      return { error: message };
    }
  }, []);

  const updatePreference = useCallback(
    async (
      key: NotificationPreferenceKey,
      value: boolean,
    ): Promise<{ error: string | null }> => {
      if (!userId || !preferences) {
        return { error: "Enable notifications on this device first." };
      }
      const previous = preferences;
      setPreferences({ ...preferences, [key]: value });
      const patch = {
        [key]: value,
        updated_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["notification_preferences"]["Update"];
      const { error: updateError } = await supabase
        .from("notification_preferences")
        .update(patch)
        .eq("user_id", userId);
      if (updateError) {
        setPreferences(previous);
        return { error: updateError.message };
      }
      return { error: null };
    },
    [preferences, userId],
  );

  const setAllPreferences = useCallback(
    async (value: boolean): Promise<{ error: string | null }> => {
      if (!userId || !preferences) {
        return { error: "Enable notifications on this device first." };
      }
      const previous = preferences;
      const next = {
        ...preferences,
        friend_requests: value,
        friend_accepts: value,
        weekly_recaps: value,
        streak_risk: value,
        inactivity: value,
        updated_at: new Date().toISOString(),
      };
      setPreferences(next);
      const { error: updateError } = await supabase
        .from("notification_preferences")
        .update({
          friend_requests: value,
          friend_accepts: value,
          weekly_recaps: value,
          streak_risk: value,
          inactivity: value,
          updated_at: next.updated_at,
        })
        .eq("user_id", userId);
      if (updateError) {
        setPreferences(previous);
        return { error: updateError.message };
      }
      return { error: null };
    },
    [preferences, userId],
  );

  const value = useMemo<PushState>(
    () => ({
      available: isNativeIos,
      permission,
      active,
      preferences,
      error,
      enable,
      disable,
      updatePreference,
      setAllPreferences,
    }),
    [active, disable, enable, error, permission, preferences, setAllPreferences, updatePreference],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePushNotifications(): PushState {
  const context = useContext(PushContext);
  if (!context) {
    throw new Error("usePushNotifications must be used within its provider");
  }
  return context;
}
