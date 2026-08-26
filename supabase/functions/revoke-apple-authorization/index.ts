import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";
import {
  readJsonBody,
  RequestError,
  safeErrorType,
} from "../_shared/request.ts";

type AppleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Sign in with Apple revocation is not configured.");
  return value.replaceAll("\\n", "\n");
}

function appleTeamId(): string {
  const value =
    Deno.env.get("APPLE_SIGN_IN_TEAM_ID")?.trim() ??
    Deno.env.get("APPLE_TEAM_ID")?.trim();
  if (!value) throw new Error("Sign in with Apple revocation is not configured.");
  return value;
}

function base64Url(value: Uint8Array | string): string {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const encoded = token.split(".")[1];
  if (!encoded) throw new Error("Apple returned an invalid identity token.");
  const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

function pemBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function clientSecret(clientId: string): Promise<string> {
  const header = base64Url(
    JSON.stringify({ alg: "ES256", kid: requiredSecret("APPLE_SIGN_IN_KEY_ID") }),
  );
  const now = Math.floor(Date.now() / 1000);
  const claims = base64Url(
    JSON.stringify({
      iss: appleTeamId(),
      iat: now,
      exp: now + 300,
      aud: "https://appleid.apple.com",
      sub: clientId,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(requiredSecret("APPLE_SIGN_IN_PRIVATE_KEY")),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signingInput = `${header}.${claims}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput),
    ),
  );
  return `${signingInput}.${base64Url(signature)}`;
}

async function postApple(
  path: "token" | "revoke",
  values: Record<string, string>,
): Promise<Response> {
  return fetch(`https://appleid.apple.com/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
}

Deno.serve(async (request) => {
  const corsHeaders = corsHeadersFor(request);
  if (request.method === "OPTIONS") return preflightResponse(request);
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new RequestError("Sign in before deleting your account.", 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new RequestError("Your session has expired.", 401);

    const appleIdentity = authData.user.identities?.find(
      (identity) => identity.provider === "apple",
    );
    if (!appleIdentity) {
      return Response.json({ revoked: false, required: false }, { headers: corsHeaders });
    }

    const body = await readJsonBody<{
      authorizationCode?: string;
      identityToken?: string;
    }>(request);
    if (!body.authorizationCode || !body.identityToken) {
      throw new Error("Apple reauthorization is required.");
    }

    const presentedClaims = decodeJwtPayload(body.identityToken);
    const expectedSubject =
      (appleIdentity.identity_data?.sub as string | undefined) ??
      appleIdentity.identity_id;
    if (!expectedSubject || presentedClaims.sub !== expectedSubject) {
      throw new Error("That Apple account does not match this Klimb account.");
    }

    const clientId =
      Deno.env.get("APPLE_SIGN_IN_CLIENT_ID")?.trim() ?? "com.nickyocom.klimb";
    const secret = await clientSecret(clientId);
    const tokenResponse = await postApple("token", {
      client_id: clientId,
      client_secret: secret,
      code: body.authorizationCode,
      grant_type: "authorization_code",
    });
    const tokens = (await tokenResponse.json()) as AppleTokenResponse;
    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description ?? tokens.error ?? "Apple rejected reauthorization.");
    }

    if (tokens.id_token) {
      const exchangedClaims = decodeJwtPayload(tokens.id_token);
      if (exchangedClaims.sub !== expectedSubject) {
        throw new Error("Apple returned credentials for a different account.");
      }
    }

    const token = tokens.refresh_token ?? tokens.access_token;
    const tokenType = tokens.refresh_token ? "refresh_token" : "access_token";
    if (!token) throw new Error("Apple returned no revocable token.");

    const revokeResponse = await postApple("revoke", {
      client_id: clientId,
      client_secret: secret,
      token,
      token_type_hint: tokenType,
    });
    if (!revokeResponse.ok) throw new Error("Apple could not revoke authorization.");

    return Response.json({ revoked: true, required: true }, { headers: corsHeaders });
  } catch (error) {
    console.error(
      "Apple authorization revocation failed:",
      safeErrorType(error),
    );
    return Response.json(
      {
        error: error instanceof RequestError
          ? error.message
          : "Apple authorization could not be revoked.",
      },
      {
        status: error instanceof RequestError ? error.status : 400,
        headers: corsHeaders,
      },
    );
  }
});
