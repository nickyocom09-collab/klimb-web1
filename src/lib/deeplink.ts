import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";

/**
 * Klimb's custom URL scheme (registered in ios/App/App/Info.plist as
 * CFBundleURLTypes). Auth emails (confirm signup, reset password) and OAuth
 * providers redirect here on native builds so the link reopens the app
 * itself instead of Safari, which has nothing to show for an internal
 * scheme/localhost address.
 */
const NATIVE_SCHEME = "klimb://auth-callback";

/** Build the right redirect target for the current platform: the native
 *  deep link on device, or the current page's origin in a normal browser
 *  (web dev, or if the app is ever run as a website). */
export function authRedirectUrl(path = ""): string {
  const suffix = path ? `/${path.replace(/^\//, "")}` : "";
  if (Capacitor.isNativePlatform()) {
    return `${NATIVE_SCHEME}${suffix}`;
  }
  return `${window.location.origin}${suffix}`;
}

/** Wire up appUrlOpen so tapping an auth email link on the phone hands the
 *  session straight to Supabase and routes to the right screen. Call once,
 *  after the router is mounted. */
export function setupDeepLinks(navigate: (path: string) => void) {
  if (!Capacitor.isNativePlatform()) return;

  App.addListener("appUrlOpen", async ({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "klimb:") return;

      // Supabase puts the session tokens in the hash fragment (implicit
      // flow) or, occasionally, the query string.
      const raw = parsed.hash ? parsed.hash.slice(1) : parsed.search.slice(1);
      const params = new URLSearchParams(raw);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      const type = params.get("type");

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }

      navigate(parsed.pathname.includes("reset-password") || type === "recovery"
        ? "/reset-password"
        : "/");
    } catch (err) {
      console.warn("[Klimb] Failed to handle auth deep link", url, err);
    }
  });
}
