import { registerPlugin, Capacitor } from "@capacitor/core";

// Native bridge to MessageComposePlugin declared in ios/App/App/AppDelegate.swift.
// Opens the system Messages (SMS/iMessage) composer directly with an image
// attached — a dedicated "Message" share target, same pattern as the
// Instagram Stories direct-share.
export interface MessageComposePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  send(options: { text?: string; imageBase64?: string }): Promise<{ sent: boolean }>;
}

export const MessageCompose = registerPlugin<MessageComposePlugin>("MessageCompose");

/** Only iOS has the native plugin. */
export function canUseNativeMessageCompose(): boolean {
  return Capacitor.getPlatform() === "ios";
}
