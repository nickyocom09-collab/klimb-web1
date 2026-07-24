import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FACEBOOK_APP_ID } from "./constants";
import { InstagramStories, toRawBase64 } from "./instagramStories";
import { MessageCompose, canUseNativeMessageCompose } from "./messageCompose";

/**
 * Shared image-sharing primitives used by the weekly recap and per-climb
 * shares. Each returns `true` when it handled the share so the caller can
 * decide whether to fall through to the generic OS share sheet.
 */

/** iOS + Instagram installed + a Facebook App ID configured → Stories composer. */
export async function shareCanvasToInstagram(
  canvas: HTMLCanvasElement,
): Promise<boolean> {
  if (Capacitor.getPlatform() !== "ios" || !FACEBOOK_APP_ID) return false;
  try {
    const { available } = await InstagramStories.isAvailable();
    if (!available) return false;
    await InstagramStories.shareToStory({
      appId: FACEBOOK_APP_ID,
      backgroundImageBase64: toRawBase64(canvas.toDataURL("image/png")),
    });
    return true;
  } catch {
    return false;
  }
}

/** iOS → native Messages composer with the image attached. */
export async function shareCanvasToMessages(
  canvas: HTMLCanvasElement,
  text: string,
): Promise<boolean> {
  if (!canUseNativeMessageCompose()) return false;
  try {
    const { available } = await MessageCompose.isAvailable();
    if (!available) return false;
    await MessageCompose.send({
      text,
      imageBase64: toRawBase64(canvas.toDataURL("image/png")),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * The generic OS share sheet (covers Messenger, WhatsApp, Mail, copy, save…).
 * `onFallback` receives a PNG data URL when no share surface is available so
 * the caller can show an in-app preview to save manually.
 */
export async function shareCanvasViaSheet(
  canvas: HTMLCanvasElement,
  opts: { filename: string; title: string; text: string; onFallback?: (dataUrl: string) => void },
): Promise<void> {
  const { filename, title, text, onFallback } = opts;

  if (Capacitor.isNativePlatform()) {
    // navigator.share with files is unreliable in the iOS WKWebView — write the
    // PNG to the cache dir and hand its URI to the native share sheet.
    try {
      const base64 = canvas.toDataURL("image/png").split(",")[1];
      await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
      await Share.share({ title, text, files: [uri] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel/i.test(msg)) onFallback?.(canvas.toDataURL("image/png"));
    }
    return;
  }

  await new Promise<void>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve();
      const file = new File([blob], filename, { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title, text });
          return resolve();
        }
      } catch (err) {
        const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
        if (/abort|cancel/i.test(msg)) return resolve(); // user closed the sheet
      }
      onFallback?.(canvas.toDataURL("image/png"));
      resolve();
    }, "image/png");
  });
}
