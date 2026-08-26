import type { User } from "@supabase/supabase-js";
import { AppleSignIn, canUseNativeAppleSignIn } from "./appleSignIn";
import { supabase } from "./supabase";

export function userHasAppleIdentity(user: User): boolean {
  return (
    user.app_metadata.provider === "apple" ||
    user.app_metadata.providers?.includes("apple") === true ||
    user.identities?.some((identity) => identity.provider === "apple") === true
  );
}

export type AppleRevocationCredentials = {
  authorizationCode: string;
  identityToken: string;
};

/**
 * Apple expects its authorization to be revoked when an account is deleted.
 * A fresh native authorization code proves that the person deleting the
 * account controls the same Apple identity; the server exchanges and revokes
 * it without ever exposing the Sign in with Apple private key to the app.
 */
export async function prepareAppleAuthorizationRevocation(
  user: User,
): Promise<AppleRevocationCredentials | null> {
  if (!userHasAppleIdentity(user)) return null;
  if (!canUseNativeAppleSignIn()) {
    throw new Error(
      "Open Klimb on your iPhone to disconnect Sign in with Apple before deleting this account.",
    );
  }

  const { authorizationCode, identityToken } = await AppleSignIn.signIn();
  return { authorizationCode, identityToken };
}

export async function revokeAppleAuthorizationForDeletion(
  credentials: AppleRevocationCredentials | null,
): Promise<void> {
  if (!credentials) return;

  const { data, error } = await supabase.functions.invoke(
    "revoke-apple-authorization",
    { body: credentials },
  );
  if (error) throw error;
  if (!data?.revoked) {
    throw new Error("Apple authorization could not be disconnected.");
  }
}
