import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export type PickedPhoto = { file: File; previewUrl: string };
export type PhotoSource = "camera" | "photos";

/**
 * Pick a photo natively on iOS/Android from the source chosen in Klimb's own
 * photo sheet. Returns null if the user cancels.
 *
 * On web this returns undefined so the caller can fall back to a normal
 * <input type="file"> (native camera capture in the iOS WKWebView is
 * unreliable, which is why we use the Camera plugin on device).
 */
export async function pickPhotoNative(source?: PhotoSource): Promise<
  PickedPhoto | null | undefined
> {
  if (!Capacitor.isNativePlatform()) return undefined;
  try {
    const photo = await Camera.getPhoto({
      source:
        source === "camera"
          ? CameraSource.Camera
          : source === "photos"
            ? CameraSource.Photos
            : CameraSource.Prompt,
      // URI avoids holding a full-resolution photo as a huge base64 string in
      // the WKWebView. Capacitor exposes webPath specifically for fetch/upload.
      resultType: CameraResultType.Uri,
      quality: 82,
      allowEditing: false,
    });
    if (!photo.webPath) throw new Error("Camera returned no photo path.");
    const response = await fetch(photo.webPath);
    if (!response.ok) throw new Error("Could not read the selected photo.");
    const blob = await response.blob();
    const ext = photo.format || "jpeg";
    const file = new File([blob], `climb-${Date.now()}.${ext}`, {
      type: blob.type || `image/${ext}`,
    });
    return { file, previewUrl: URL.createObjectURL(blob) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Closing the native picker is expected. Real plugin/permission/read errors
    // must reach the UI instead of silently looking like a cancelled picker.
    if (/cancel|user cancelled|no image picked/i.test(message)) return null;
    throw error;
  }
}
