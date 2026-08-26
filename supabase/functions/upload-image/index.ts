import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";

const ROUTE_MAX_BYTES = 12 * 1024 * 1024;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = ROUTE_MAX_BYTES + 128 * 1024;

type ImageKind = "route" | "avatar";

const SETTINGS: Record<
  ImageKind,
  { bucket: string; maxBytes: number }
> = {
  route: { bucket: "route-photos", maxBytes: ROUTE_MAX_BYTES },
  avatar: { bucket: "avatars", maxBytes: AVATAR_MAX_BYTES },
};

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function hasValidImageSignature(bytes: Uint8Array, mime: string): boolean {
  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const png =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const webp =
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP";
  const brand = bytes.length >= 12 ? ascii(bytes, 8, 4) : "";
  const heif =
    bytes.length >= 12 &&
    ascii(bytes, 4, 4) === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(
      brand,
    );

  return (
    (mime === "image/jpeg" && jpeg) ||
    (mime === "image/png" && png) ||
    (mime === "image/webp" && webp) ||
    ((mime === "image/heic" || mime === "image/heif") && heif)
  );
}

function json(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeadersFor(request), "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return preflightResponse(request);
  if (request.method !== "POST") {
    return json(request, { error: "Method not allowed." }, 405);
  }

  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json(request, { error: "That image is too large." }, 413);
  }

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
    if (authError || !authData.user) {
      return json(request, { error: "Your session has expired." }, 401);
    }

    const form = await request.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if ((kind !== "route" && kind !== "avatar") || !(file instanceof File)) {
      return json(request, { error: "A valid image upload is required." }, 400);
    }

    const settings = SETTINGS[kind];
    const mime = file.type.toLowerCase();
    const extension = EXTENSION_BY_MIME[mime];
    if (!extension || file.size <= 0 || file.size > settings.maxBytes) {
      return json(request, { error: "Choose a supported image within the size limit." }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(bytes.subarray(0, 32), mime)) {
      return json(request, { error: "The uploaded file is not a valid image." }, 400);
    }

    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: rateError } = await service.rpc("register_image_upload", {
      p_user_id: authData.user.id,
      p_image_kind: kind,
    });
    if (rateError?.code === "P0001") {
      return json(request, { error: "Too many uploads. Please wait and try again." }, 429);
    }
    if (rateError) throw rateError;

    const path = `${authData.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await service.storage
      .from(settings.bucket)
      .upload(path, bytes, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const publicUrl = service.storage.from(settings.bucket).getPublicUrl(path)
      .data.publicUrl;
    return json(request, { path, publicUrl });
  } catch (error) {
    console.error("Secure image upload failed", {
      type: error instanceof Error ? error.name : "UnknownError",
    });
    return json(request, { error: "The image could not be uploaded." }, 500);
  }
});
