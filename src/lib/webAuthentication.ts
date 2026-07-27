import { Capacitor, registerPlugin } from "@capacitor/core";

interface WebAuthenticationResult {
  callbackUrl: string;
}

interface WebAuthenticationPlugin {
  authenticate(options: {
    url: string;
    callbackScheme: string;
  }): Promise<WebAuthenticationResult>;
}

export const WebAuthentication =
  registerPlugin<WebAuthenticationPlugin>("WebAuthentication");

export function canUseNativeWebAuthentication(): boolean {
  return Capacitor.getPlatform() === "ios";
}
