import { registerPlugin } from "@capacitor/core";

// Native bridge to the custom InstagramStoriesPlugin declared in
// ios/App/App/AppDelegate.swift. Web/Android fall back to a no-op (the
// caller should check Capacitor.getPlatform() === "ios" before using this).
export interface InstagramStoriesPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  shareToStory(options: {
    /** Facebook App ID — required by Instagram for the source_application param. */
    appId: string;
    /** Raw base64 PNG/JPEG data, no "data:image/..." prefix. */
    backgroundImageBase64: string;
    /** Optional sticker layer, same base64 format. */
    stickerImageBase64?: string;
  }): Promise<void>;
}

export const InstagramStories = registerPlugin<InstagramStoriesPlugin>(
  "InstagramStories",
);

/** Strip the "data:image/png;base64," prefix off a canvas data URL. */
export function toRawBase64(dataUrl: string): string {
  return dataUrl.split(",")[1] ?? dataUrl;
}
