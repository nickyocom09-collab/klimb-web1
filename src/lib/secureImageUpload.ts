import { supabase } from "./supabase";

export type ImageUploadKind = "route" | "avatar";

type UploadResponse = {
  path?: string;
  publicUrl?: string;
  error?: string;
};

/** Upload through the authenticated server validator, never straight to Storage. */
export async function secureImageUpload(file: File, kind: ImageUploadKind) {
  const body = new FormData();
  body.append("kind", kind);
  body.append("file", file, file.name);

  const { data, error } = await supabase.functions.invoke<UploadResponse>(
    "upload-image",
    { body },
  );
  if (error) throw new Error("The image could not be uploaded. Please try again.");
  if (!data?.path || !data.publicUrl) {
    throw new Error(data?.error ?? "The image upload returned an invalid response.");
  }
  return { path: data.path, publicUrl: data.publicUrl };
}
