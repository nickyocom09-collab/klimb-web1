import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

// Public OAuth identifiers. The server/web client is already configured in
// Supabase and is the audience of Google's ID token. Native iOS sign-in also
// needs an iOS-type client tied to com.nickyocom.klimb.
const GOOGLE_WEB_CLIENT_ID =
  "941755937-p0kc85680uuo7qpmb8metona0ssdhrbo.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined)?.trim() ||
  "941755937-4idiugslvi6hcje2avpo75dma5cifhij.apps.googleusercontent.com";

let initializedFor: string | null = null;

export function canUseNativeGoogleSignIn(): boolean {
  return Capacitor.getPlatform() === "ios" && !!GOOGLE_IOS_CLIENT_ID;
}

export async function nativeGoogleSignIn(): Promise<{
  idToken: string;
  nonce: string;
}> {
  if (!GOOGLE_IOS_CLIENT_ID) {
    throw new Error("Native Google Sign-In is missing its iOS client ID.");
  }

  if (initializedFor !== GOOGLE_IOS_CLIENT_ID) {
    await SocialLogin.initialize({
      google: {
        iOSClientId: GOOGLE_IOS_CLIENT_ID,
        iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
        webClientId: GOOGLE_WEB_CLIENT_ID,
        mode: "online",
      },
    });
    initializedFor = GOOGLE_IOS_CLIENT_ID;
  }

  // Supabase requires the raw nonce while Google receives its SHA-256 hash.
  // Supplying the matched pair prevents the "passed nonce and nonce in
  // id_token should either both exist or not" rejection.
  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = Array.from(nonceBytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const encodedNonce = new TextEncoder().encode(nonce);
  const hash = await crypto.subtle.digest("SHA-256", encodedNonce);
  const hashedNonce = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  const login = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["email", "profile"],
      nonce: hashedNonce,
      // Force Google's native account selection surface on every tap.
      forcePrompt: true,
    },
  });
  const result = login.result;
  if (result.responseType !== "online" || !result.idToken) {
    throw new Error("Google returned without an identity token.");
  }
  return {
    idToken: result.idToken,
    nonce,
  };
}
