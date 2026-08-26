import { supabase } from "./supabase";
import {
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
} from "./constants";

type AuthorizeResponse = { path?: string; token?: string; error?: string };
type FinalizeResponse = {
  video?: { id: string; storage_path: string };
  error?: string;
};

function videoMimeFor(file: File): string | null {
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "mp4") return "video/mp4";
  if (extension === "mov") return "video/quicktime";
  if (extension === "m4v") return "video/x-m4v";
  return null;
}

export async function validateVideoForUpload(file: File): Promise<string | null> {
  if (!videoMimeFor(file) || file.size <= 0) {
    return "That video format isn't supported. Choose a video from your photo library.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return "This clip is too large to upload. Try trimming it to under three minutes.";
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error("metadata"));
      video.src = objectUrl;
    });
    if (!Number.isFinite(duration) || duration <= 0) {
      return "That video couldn't be read. Choose another clip.";
    }
    if (duration > MAX_VIDEO_DURATION_SECONDS + 0.25) {
      return "Choose a video under three minutes.";
    }
    return null;
  } catch {
    return "That video couldn't be read. Choose another clip.";
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function secureVideoUpload(file: File, routeId: string, caption: string) {
  const mime = videoMimeFor(file);
  if (!mime) throw new Error("That video format isn't supported.");
  const { data: authorization, error: authorizationError } =
    await supabase.functions.invoke<AuthorizeResponse>("upload-video", {
      body: { action: "authorize", routeId, caption, mime, bytes: file.size },
    });
  if (authorizationError || !authorization?.path || !authorization.token) {
    throw new Error(authorization?.error ?? "The video upload could not be authorized.");
  }

  const { error: uploadError } = await supabase.storage
    .from("climb-videos")
    .uploadToSignedUrl(authorization.path, authorization.token, file, {
      contentType: mime,
      cacheControl: "31536000",
    });
  if (uploadError) throw new Error("The video upload was interrupted. Please try again.");

  const { data: finalized, error: finalizeError } =
    await supabase.functions.invoke<FinalizeResponse>("upload-video", {
      body: { action: "finalize", routeId, caption, path: authorization.path },
    });
  if (finalizeError || !finalized?.video) {
    await supabase.storage.from("climb-videos").remove([authorization.path]).catch(() => undefined);
    throw new Error(finalized?.error ?? "The uploaded video could not be verified.");
  }
  return finalized.video;
}
