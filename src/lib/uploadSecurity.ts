export const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";

export const ROUTE_PHOTO_MAX_BYTES = 12 * 1024 * 1024;
export const AVATAR_SOURCE_MAX_BYTES = 12 * 1024 * 1024;

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function imageUploadError(
  file: File,
  maxBytes = ROUTE_PHOTO_MAX_BYTES,
): string | null {
  if (!EXTENSION_BY_MIME[file.type.toLowerCase()]) {
    return "Choose a JPEG, PNG, WebP, HEIC, or HEIF image.";
  }
  if (file.size <= 0) return "That image is empty. Choose another photo.";
  if (file.size > maxBytes) {
    return `That image is too large. Choose one under ${Math.floor(maxBytes / 1024 / 1024)} MB.`;
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

/**
 * Verify the bytes agree with the declared image type. Browser-provided MIME
 * values are user-controlled, so the allowlist above is only the first layer.
 * The storage bucket repeats the MIME/size limits server-side; this signature
 * check catches disguised HTML/SVG payloads before the normal client uploads.
 */
export async function imageContentError(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const type = file.type.toLowerCase();

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
  const heifBrand = bytes.length >= 12 ? ascii(bytes, 8, 4) : "";
  const heif =
    bytes.length >= 12 &&
    ascii(bytes, 4, 4) === "ftyp" &&
    new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"])
      .has(heifBrand);

  const valid =
    (type === "image/jpeg" && jpeg) ||
    (type === "image/png" && png) ||
    (type === "image/webp" && webp) ||
    ((type === "image/heic" || type === "image/heif") && heif);

  return valid
    ? null
    : "That file does not contain a valid JPEG, PNG, WebP, HEIC, or HEIF image.";
}

/**
 * Storage object names never reuse the user-controlled filename or extension.
 * Supabase also enforces the MIME allowlist and size ceiling server-side.
 */
export function safeImageExtension(file: File): string {
  const extension = EXTENSION_BY_MIME[file.type.toLowerCase()];
  if (!extension) throw new Error("Unsupported image type.");
  return extension;
}
