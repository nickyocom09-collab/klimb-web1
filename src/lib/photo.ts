import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export type PickedPhoto = { file: File; previewUrl: string };

/**
 * Pick a photo natively on iOS/Android: shows the system "Camera or Photo
 * Library" chooser (CameraSource.Prompt) and returns it as a File plus a
 * preview data URL. Returns null if the user cancels.
 *
 * On web this returns undefined so the caller can fall back to a normal
 * <input type="file"> (native camera capture in the iOS WKWebView is
 * unreliable, which is why we use the Camera plugin on device).
 */
export async function pickPhotoNative(): Promise<
  PickedPhoto | null | undefined
> {
  if (!Capacitor.isNativePlatform()) return undefined;
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt, // "Take Photo" or "Choose from Library"
      resultType: CameraResultType.DataUrl,
      quality: 82,
      allowEditing: false,
      promptLabelHeader: "Add a photo",
      promptLabelPhoto: "Choose from Library",
      promptLabelPicture: "Take Photo",
    });
    if (!photo.dataUrl) return null;
    const blob = await (await fetch(photo.dataUrl)).blob();
    const ext = photo.format || "jpeg";
    const file = new File([blob], `climb-${Date.now()}.${ext}`, {
      type: blob.type || `image/${ext}`,
    });
    return { file, previewUrl: photo.dataUrl };
  } catch {
    // User cancelled the prompt, or camera/library unavailable — treat as no-op.
    return null;
  }
}
