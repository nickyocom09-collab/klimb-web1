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
const DEFAULT_EMAIL_CONFIRMATION_PAGE =
  "https://klimb-privacy.vercel.app/verified.html";
const FRIEND_INVITE_HOSTS = new Set(["klimb-privacy.vercel.app"]);
export const PENDING_PROFILE_KEY = "klimb:pending-profile";

const PROFILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function friendRequestPath(profileId: string): string | null {
  return PROFILE_ID_PATTERN.test(profileId)
    ? `/u/${profileId}?friendRequest=1`
    : null;
}

export function friendRequestProfileId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const isUniversalLink =
      parsed.protocol === "https:" &&
      FRIEND_INVITE_HOSTS.has(parsed.hostname) &&
      parsed.pathname === "/add.html";
    const isCustomLink =
      parsed.protocol === "klimb:" && parsed.hostname === "profile";
    if (!isUniversalLink && !isCustomLink) return null;
    const profileId = isUniversalLink
      ? parsed.searchParams.get("id") ?? ""
      : parsed.pathname.replace(/^\//, "").split("/")[0];
    return PROFILE_ID_PATTERN.test(profileId) ? profileId : null;
  } catch {
    return null;
  }
}

/**
 * Email confirmation first lands on a polished HTTPS page. That page forwards
 * the one-time PKCE code to the native app only when the user taps Open Klimb.
 */
export function emailConfirmationRedirectUrl(): string {
  const configured = (
    import.meta.env.VITE_EMAIL_CONFIRMATION_URL as string | undefined
  )?.trim();
  return configured || DEFAULT_EMAIL_CONFIRMATION_PAGE;
}

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
      const isNativeScheme = parsed.protocol === "klimb:";
      const friendProfileId = friendRequestProfileId(url);
      if (!isNativeScheme && !friendProfileId) return;

      // A scanned Klimb code always lands at the friend-request action. Keep
      // the profile id through onboarding when the recipient is signed out.
      if (friendProfileId) {
        const path = friendRequestPath(friendProfileId);
        const { data } = await supabase.auth.getSession();
        if (data.session && path) {
          localStorage.removeItem(PENDING_PROFILE_KEY);
          navigate(path);
        } else {
          localStorage.setItem(PENDING_PROFILE_KEY, friendProfileId);
          navigate("/welcome");
        }
        return;
      }

      // A malformed profile link is not an auth callback and must not dump the
      // recipient at the app home screen.
      if (isNativeScheme && parsed.hostname === "profile") return;

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
      // Never print the callback URL: recovery links can contain live access
      // and refresh tokens. Keep logs useful without leaking credentials.
      console.warn(
        "[Klimb] Failed to handle auth deep link",
        err instanceof Error ? err.message : "Unknown authentication error",
      );
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
