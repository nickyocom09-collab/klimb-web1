import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { supabase } from "./supabase";

// Anti-cheat: you have to actually be near a gym to make it your home gym, so
// people can't swap to a far-away gym and pad their logbook there.
export const MAX_HOME_GYM_MILES = 30;

/** Great-circle distance in miles between two lat/lng points. */
export function milesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type Coords = { lat: number; lng: number };

async function nativeCoords(): Promise<Coords> {
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000,
  });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

/** Get the device's current position. Rejects with a friendly message if
 *  location is unavailable or the user denied permission. */
export async function getCurrentCoords(): Promise<Coords> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await nativeCoords();
    } catch {
      throw new Error(
        "Turn on location for Klimb in Settings so we can confirm you're near the gym.",
      );
    }
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location isn't available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Turn on location to set your home gym — we check you're actually near it."
              : "Couldn't get your location. Try again near the gym.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Read location only when permission is already granted. Used for the map's
 * distance hints so merely opening Map never triggers a permission popup. */
export async function getCurrentCoordsIfAuthorized(): Promise<Coords | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const permission = await Geolocation.checkPermissions();
      if (
        permission.location !== "granted" &&
        permission.coarseLocation !== "granted"
      ) {
        return null;
      }
      return await nativeCoords();
    } catch {
      return null;
    }
  }

  if (!navigator.geolocation || !navigator.permissions) return null;
  try {
    const permission = await navigator.permissions.query({
      name: "geolocation",
    });
    if (permission.state !== "granted") return null;
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/**
 * Verify the device is within range of a gym. This fails CLOSED: if the gym has
 * no coordinates on file, or we can't read the device location, it returns not-ok.
 * That's deliberate anti-cheat — you should never be able to make a far-away gym
 * yours (or log there) just because a location check couldn't run.
 */
export async function assertNearGym(gym: {
  name?: string | null;
  latitude: number | null;
  longitude: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (gym.latitude == null || gym.longitude == null) {
    return {
      ok: false,
      error: "This gym doesn't have a location on file yet, so we can't confirm you're there.",
    };
  }
  try {
    const me = await getCurrentCoords();
    const miles = milesBetween(me.lat, me.lng, gym.latitude, gym.longitude);
    if (miles > MAX_HOME_GYM_MILES) {
      return {
        ok: false,
        error: `You're about ${Math.round(miles)} mi from ${gym.name ?? "this gym"}. Get within ${MAX_HOME_GYM_MILES} mi of it to make it yours.`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Location check failed." };
  }
}

/**
 * A device only has to pass the radius check for its first log at a gym. Once
 * that gym is unlocked, logging and the full logbook work from anywhere. We
 * persist only the user/gym pair — never the device's coordinates.
 */
export async function ensureGymUnlocked(
  userId: string,
  gymId: string,
  gym: {
    name?: string | null;
    latitude: number | null;
    longitude: number | null;
  },
): Promise<{ ok: boolean; unlockedNow?: boolean; error?: string }> {
  const { data, error: lookupError } = await supabase
    .from("gym_unlocks")
    .select("gym_id")
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .maybeSingle();
  if (lookupError) {
    return { ok: false, error: "Klimb needs the latest gym-unlock database update." };
  }
  if (data) return { ok: true, unlockedNow: false };

  const near = await assertNearGym(gym);
  if (!near.ok) {
    return {
      ok: false,
      error:
        near.error ??
        `Your first log at this gym must be within ${MAX_HOME_GYM_MILES} miles.`,
    };
  }

  const { error } = await supabase.from("gym_unlocks").insert({
    user_id: userId,
    gym_id: gymId,
  });
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  return { ok: true, unlockedNow: true };
}
