import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";

const MAX_BYTES = 250 * 1024 * 1024;
const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeadersFor(request), "Cache-Control": "no-store" },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hasIsoBaseMediaSignature(bytes: Uint8Array) {
  if (bytes.length < 12) return false;
  const marker = String.fromCharCode(...bytes.slice(4, 8));
  const brand = String.fromCharCode(...bytes.slice(8, 12));
  return marker === "ftyp" && /^[\x20-\x7e]{4}$/.test(brand);
}

function normalizedMime(value: string | null | undefined) {
  return String(value ?? "").split(";", 1)[0].trim().toLowerCase();
}

function entitlementIsActive(row: Record<string, unknown> | null) {
  if (!row) return false;
  if (row.is_lifetime_pro === true) return true;
  const status = String(row.entitlement_status ?? "");
  if (!["active", "trial", "grace_period"].includes(status)) return false;
  const expiration = row.expiration_date;
  return !expiration || Date.parse(String(expiration)) > Date.now();
}

async function canAttachToRoute(
  service: ReturnType<typeof createClient<any>>,
  userId: string,
  routeId: string,
) {
  const [{ data: route }, { data: send }, { data: project }] = await Promise.all([
    service.from("routes").select("id, created_by, status, hidden").eq("id", routeId).maybeSingle(),
    service.from("sends").select("id").eq("route_id", routeId).eq("user_id", userId).limit(1).maybeSingle(),
    service.from("bookmarks").select("id").eq("route_id", routeId).eq("user_id", userId).eq("kind", "project").limit(1).maybeSingle(),
  ]);
  return !!route && !route.hidden && route.status === "active" &&
    (route.created_by === userId || !!send || !!project);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return preflightResponse(request);
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json(request, { error: "Sign in required." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json(request, { error: "Your session has expired." }, 401);
    const userId = authData.user.id;
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: entitlement } = await service
      .from("user_entitlements")
      .select("is_lifetime_pro, entitlement_status, expiration_date")
      .eq("user_id", userId)
      .maybeSingle();
    if (!entitlementIsActive(entitlement)) {
      return json(request, { error: "Klimb Pro is required to upload videos." }, 403);
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const action = String(payload?.action ?? "");
    const routeId = String(payload?.routeId ?? "");
    const caption = String(payload?.caption ?? "").trim();
    if (!isUuid(routeId) || caption.length > 120) {
      return json(request, { error: "A valid climb is required." }, 400);
    }
    if (!await canAttachToRoute(service, userId, routeId)) {
      return json(request, { error: "Choose a climb from your logbook." }, 403);
    }

    if (action === "authorize") {
      const mime = String(payload?.mime ?? "").toLowerCase();
      const bytes = Number(payload?.bytes ?? 0);
      const extension = MIME_EXTENSIONS[mime];
      if (!extension || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
        return json(request, { error: "That video can't be uploaded. Choose a clip under three minutes." }, 400);
      }
      const { error: rateError } = await service.rpc("register_video_upload", { p_user_id: userId });
      if (rateError?.code === "P0001") return json(request, { error: rateError.message }, 429);
      if (rateError) throw rateError;

      const { data: expired } = await service
        .from("pending_video_uploads")
        .select("storage_path")
        .eq("user_id", userId)
        .lt("expires_at", new Date().toISOString());
      const expiredPaths = (expired ?? []).map((row) => row.storage_path);
      if (expiredPaths.length) {
        await service.storage.from("climb-videos").remove(expiredPaths);
        await service.from("pending_video_uploads").delete().in("storage_path", expiredPaths);
      }

      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { data: signed, error: signedError } = await service.storage
        .from("climb-videos")
        .createSignedUploadUrl(path);
      if (signedError) throw signedError;
      const { error: pendingError } = await service.from("pending_video_uploads").insert({
        user_id: userId,
        route_id: routeId,
        storage_path: path,
        caption: caption || null,
        expected_bytes: bytes,
        expected_mime: mime,
      });
      if (pendingError) throw pendingError;
      return json(request, { path, token: signed.token });
    }

    if (action === "finalize") {
      const path = String(payload?.path ?? "");
      if (!path.startsWith(`${userId}/`) || path.length > 300) {
        return json(request, { error: "That upload is not valid." }, 400);
      }
      const { data: pending } = await service
        .from("pending_video_uploads")
        .select("*")
        .eq("storage_path", path)
        .eq("user_id", userId)
        .eq("route_id", routeId)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!pending) return json(request, { error: "That upload expired. Please try again." }, 410);

      const fileName = path.slice(path.indexOf("/") + 1);
      const { data: objects } = await service.storage.from("climb-videos").list(userId, {
        search: fileName,
        limit: 10,
      });
      const object = objects?.find((candidate) => candidate.name === fileName);
      const actualSize = Number(object?.metadata?.size ?? 0);
      const actualMime = normalizedMime(
        object?.metadata?.mimetype ?? object?.metadata?.contentType,
      );
      if (!object || actualSize !== Number(pending.expected_bytes) ||
          actualSize > MAX_BYTES ||
          (actualMime && actualMime !== normalizedMime(pending.expected_mime))) {
        await service.storage.from("climb-videos").remove([path]);
        await service.from("pending_video_uploads").delete().eq("storage_path", path);
        return json(request, { error: "The stored video did not match the selected file." }, 400);
      }
      const { data: signedRead, error: readError } = await service.storage
        .from("climb-videos")
        .createSignedUrl(path, 60);
      if (readError) throw readError;
      const signatureResponse = await fetch(signedRead.signedUrl, {
        headers: { Range: "bytes=0-31" },
      });
      const signatureBytes = new Uint8Array(await signatureResponse.arrayBuffer());
      if (!signatureResponse.ok || !hasIsoBaseMediaSignature(signatureBytes.subarray(0, 32))) {
        await service.storage.from("climb-videos").remove([path]);
        await service.from("pending_video_uploads").delete().eq("storage_path", path);
        return json(request, { error: "The uploaded file is not a valid video." }, 400);
      }

      const { data: previous } = await service
        .from("climb_videos")
        .select("storage_path")
        .eq("user_id", userId)
        .eq("route_id", routeId)
        .maybeSingle();
      const { data: video, error: metadataError } = await service
        .from("climb_videos")
        .upsert({
          user_id: userId,
          route_id: routeId,
          storage_path: path,
          caption: caption || pending.caption,
          visibility: "public",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,route_id" })
        .select("id, storage_path")
        .single();
      if (metadataError) throw metadataError;
      await service.from("pending_video_uploads").delete().eq("storage_path", path);
      if (previous?.storage_path && previous.storage_path !== path) {
        await service.storage.from("climb-videos").remove([previous.storage_path]);
      }
      return json(request, { video });
    }

    return json(request, { error: "Unknown upload action." }, 400);
  } catch (error) {
    console.error("Secure video upload failed", {
      type: error instanceof Error ? error.name : "UnknownError",
    });
    return json(request, { error: "The video could not be uploaded." }, 500);
  }
});
