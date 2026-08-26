const NATIVE_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
]);

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

function configuredWebOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("ALLOWED_WEB_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

/**
 * Capacitor requests come from a small, known set of native origins. Web
 * deployments must opt in through ALLOWED_WEB_ORIGINS. Returning no
 * Access-Control-Allow-Origin for an unknown site makes browsers block it;
 * authenticated non-browser requests remain unaffected.
 */
export function corsHeadersFor(request: Request): HeadersInit {
  const origin = request.headers.get("Origin")?.trim() ?? "";
  const allowed =
    NATIVE_ORIGINS.has(origin) ||
    isLocalDevelopmentOrigin(origin) ||
    configuredWebOrigins().has(origin);

  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function preflightResponse(request: Request): Response {
  const origin = request.headers.get("Origin")?.trim() ?? "";
  const headers = corsHeadersFor(request);
  if (origin && !(headers as Record<string, string>)["Access-Control-Allow-Origin"]) {
    return new Response("Origin not allowed.", { status: 403, headers });
  }
  return new Response("ok", { headers });
}
