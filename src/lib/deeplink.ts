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

      // Two possible shapes come back here:
      //  1. Implicit flow (email confirm / recovery): tokens in the hash.
      //  2. PKCE OAuth (Google, Apple-on-web): a `?code=` in the query that
      //     must be exchanged for a session. This second case is what makes
      //     Google sign-in actually complete — without the exchange the app
      //     reopens but never gets a session.
      const hashParams = new URLSearchParams(
        parsed.hash ? parsed.hash.slice(1) : "",
      );
      const queryParams = new URLSearchParams(parsed.search.slice(1));
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");
      const code = queryParams.get("code");
      const type = hashParams.get("type") ?? queryParams.get("type");

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      } else if (code) {
        // Complete the PKCE handshake (uses the code verifier stashed in
        // storage when signInWithOAuth kicked things off).
        await supabase.auth.exchangeCodeForSession(code);
      }

      navigate(parsed.pathname.includes("reset-password") || type === "recovery"
        ? "/reset-password"
        : "/");
    } catch (err) {
      console.warn("[Klimb] Failed to handle auth deep link", url, err);
    }
  });
}
