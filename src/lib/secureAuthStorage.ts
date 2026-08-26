import { Capacitor, registerPlugin } from "@capacitor/core";

type SecureStoragePlugin = {
  get(options: { key: string }): Promise<{ value?: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
};

const NativeSecureStorage = registerPlugin<SecureStoragePlugin>(
  "KlimbSecureStorage",
);

// If Keychain is temporarily unavailable (for example while iOS is still
// unlocking protected data after launch), keep Supabase usable for this app
// session without falling back to persistent, plaintext token storage.
const nativeMemoryStorage = new Map<string, string>();

function webStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/**
 * Supabase's auth storage adapter. The web build uses localStorage as usual;
 * the native iOS build keeps refresh/access tokens in the device Keychain.
 * The first read also migrates a session left by an older Klimb build.
 */
export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return webStorage()?.getItem(key) ?? null;

    try {
      const { value } = await NativeSecureStorage.get({ key });
      if (value != null) return value;

      const legacyValue = webStorage()?.getItem(key) ?? null;
      if (legacyValue != null) {
        await NativeSecureStorage.set({ key, value: legacyValue });
        webStorage()?.removeItem(key);
      }
      return legacyValue;
    } catch (error) {
      console.warn("[Klimb] Keychain read was unavailable for this session.", error);
      return nativeMemoryStorage.get(key) ?? webStorage()?.getItem(key) ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      webStorage()?.setItem(key, value);
      return;
    }
    try {
      await NativeSecureStorage.set({ key, value });
      nativeMemoryStorage.delete(key);
      webStorage()?.removeItem(key);
    } catch (error) {
      console.warn("[Klimb] Keychain write was unavailable for this session.", error);
      nativeMemoryStorage.set(key, value);
      webStorage()?.removeItem(key);
    }
  },

  async removeItem(key: string): Promise<void> {
    webStorage()?.removeItem(key);
    nativeMemoryStorage.delete(key);
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeSecureStorage.remove({ key });
      } catch (error) {
        console.warn("[Klimb] Keychain removal was unavailable.", error);
      }
    }
  },
};
