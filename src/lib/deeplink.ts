import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
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

  // Keep URL parsing in one place. In particular, Google may bring a suspended
  // app to the foreground *or* cold-launch it, so both appUrlOpen and
  // getLaunchUrl must take the same path.
  const handleUrl = async (url: string) => {
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
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
      } else if (code) {
        // Complete the PKCE handshake (uses the code verifier stashed in
        // storage when signInWithOAuth kicked things off).
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      }

      // OAuth ran in the in-app browser — close it now that we're back.
      Browser.close().catch(() => {});

      navigate(parsed.pathname.includes("reset-password") || type === "recovery"
        ? "/reset-password"
        : "/");
    } catch (err) {
      console.warn("[Klimb] Failed to handle auth deep link", url, err);
    }
  };

  const listener = App.addListener("appUrlOpen", ({ url }) => {
    void handleUrl(url);
  });

  // Without this, Google succeeds in Safari but leaves the user unsigned in
  // whenever iOS had evicted Klimb before it received the callback.
  void App.getLaunchUrl().then((launch) => {
    if (launch?.url) void handleUrl(launch.url);
  });

  return () => {
    void listener.then((handle) => handle.remove());
  };
}
