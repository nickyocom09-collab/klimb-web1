import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeVideoPickerPlugin = {
  pick(): Promise<PickedNativeVideo>;
};

export type PickedNativeVideo = {
  uri?: string | null;
  webPath?: string | null;
  name?: string | null;
  mime?: string | null;
};

const NativeVideoPicker = registerPlugin<NativeVideoPickerPlugin>(
  "VideoLibraryPicker",
);

function isPickerCancellation(error: unknown): boolean {
  return /cancel|user cancelled|no video picked/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * Convert the native picker's temporary file into the browser File used by the
 * existing validation and upload pipeline. Capacitor serves media files through
 * a WKURLSchemeHandler that returns a plain URLResponse, so WebKit can expose a
 * successful media read with `response.ok === false`. The payload itself is the
 * reliable signal here; an empty blob still fails closed.
 */
export async function fileFromPickedVideo(
  picked: PickedNativeVideo,
  fetchFile: typeof fetch = fetch,
): Promise<File | null> {
  if (!picked.uri && !picked.webPath) return null;

  const source = picked.webPath ?? Capacitor.convertFileSrc(picked.uri!);
  const response = await fetchFile(source);
  const blob = await response.blob();
  if (blob.size <= 0) throw new Error("Could not read the selected video.");

  const extension = picked.name?.split(".").pop() || "mov";
  const mime = picked.mime || blob.type || "video/quicktime";
  return new File(
    [blob],
    picked.name || `klimb-video-${Date.now()}.${extension}`,
    { type: mime },
  );
}

/**
 * Opens iOS's photo-library-only video picker. Unlike a web file input, this
 * cannot offer "Take Video", which avoids the crash in WKWebView's camera
 * capture handoff. Returning undefined keeps the normal browser input path.
 */
export async function pickVideoFromLibrary(): Promise<File | null | undefined> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return undefined;
  }

  try {
    const picked = await NativeVideoPicker.pick();
    return await fileFromPickedVideo(picked);
  } catch (error) {
    if (isPickerCancellation(error)) return null;
    throw error;
  }
}
