import { registerPlugin, Capacitor } from "@capacitor/core";

// Native bridge to MessageComposePlugin declared in ios/App/App/AppDelegate.swift.
// Opens the system Messages (SMS/iMessage) composer directly. An optional
// image is used for climb sharing; friend invites stay text-and-link only.
export interface MessageComposePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  send(options: {
    text?: string;
    imageBase64?: string;
    attachmentFilename?: string;
  }): Promise<{ sent: boolean }>;
}

export const MessageCompose = registerPlugin<MessageComposePlugin>("MessageCompose");

/** Only iOS has the native plugin. */
export function canUseNativeMessageCompose(): boolean {
  return Capacitor.getPlatform() === "ios";
}
