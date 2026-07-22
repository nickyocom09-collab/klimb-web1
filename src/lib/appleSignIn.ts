import { registerPlugin, Capacitor } from "@capacitor/core";

// Native bridge to AppleSignInPlugin declared in ios/App/App/AppDelegate.swift.
// Runs the whole "Sign in with Apple" flow in the native system sheet —
// no bounce out to Safari — then hands back the identity token + raw nonce
// so we can exchange them with Supabase via signInWithIdToken.
export interface AppleSignInResult {
  identityToken: string;
  nonce: string;
  userIdentifier: string;
  email?: string;
  fullName?: string;
}

export interface AppleSignInPlugin {
  signIn(): Promise<AppleSignInResult>;
}

export const AppleSignIn = registerPlugin<AppleSignInPlugin>("AppleSignIn");

/** Only iOS has the native plugin; everywhere else falls back to Supabase's
 *  browser-based OAuth redirect. */
export function canUseNativeAppleSignIn(): boolean {
  return Capacitor.getPlatform() === "ios";
}
