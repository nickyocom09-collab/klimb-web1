type ApnsEnvironment = "development" | "production";

type PushMessage = {
  token: string;
  environment: ApnsEnvironment;
  title: string;
  body: string;
  kind: string;
  link: string;
  data?: Record<string, unknown>;
  collapseId?: string;
};

export type ApnsResult = {
  ok: boolean;
  status: number;
  reason: string | null;
  permanentTokenFailure: boolean;
};

const encoder = new TextEncoder();
let cachedProviderToken: { value: string; expiresAt: number } | null = null;

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function privateKeyBytes(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function providerToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedProviderToken && cachedProviderToken.expiresAt > now + 60) {
    return cachedProviderToken.value;
  }

  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");
  if (!keyId || !teamId || !privateKey) {
    throw new Error("APNs provider credentials are not configured.");
  }

  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: now }));
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      encoder.encode(unsigned),
    ),
  );
  const value = `${unsigned}.${base64Url(signature)}`;
  cachedProviderToken = { value, expiresAt: now + 50 * 60 };
  return value;
}

export async function sendApns(message: PushMessage): Promise<ApnsResult> {
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID") ?? "com.nickyocom.klimb";
  const host =
    message.environment === "development"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
  const token = await providerToken();
  const response = await fetch(
    `${host}/3/device/${encodeURIComponent(message.token)}`,
    {
      method: "POST",
      headers: {
        authorization: `bearer ${token}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": String(Math.floor(Date.now() / 1000) + 7 * 86400),
        ...(message.collapseId
          ? { "apns-collapse-id": message.collapseId.slice(0, 64) }
          : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: {
          alert: { title: message.title, body: message.body },
          sound: "default",
          "thread-id": message.kind,
        },
        kind: message.kind,
        link: message.link,
        ...message.data,
      }),
    },
  );

  let reason: string | null = null;
  if (!response.ok) {
    try {
      const body = (await response.json()) as { reason?: string };
      reason = body.reason ?? `HTTP ${response.status}`;
    } catch {
      reason = `HTTP ${response.status}`;
    }
  }
  const permanentReasons = new Set([
    "BadDeviceToken",
    "DeviceTokenNotForTopic",
    "Unregistered",
  ]);
  return {
    ok: response.ok,
    status: response.status,
    reason,
    permanentTokenFailure:
      response.status === 410 ||
      (reason !== null && permanentReasons.has(reason)),
  };
}
