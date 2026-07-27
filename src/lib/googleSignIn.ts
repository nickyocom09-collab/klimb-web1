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
  accessToken?: string;
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

  const login = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["email", "profile"],
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
    accessToken: result.accessToken?.token,
  };
}
