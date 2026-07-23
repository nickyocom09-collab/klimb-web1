// Anti-cheat: you have to actually be near a gym to make it your home gym, so
// people can't swap to a far-away gym and pad their logbook there.
export const MAX_HOME_GYM_MILES = 25;

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

/** Get the device's current position. Rejects with a friendly message if
 *  location is unavailable or the user denied permission. */
export function getCurrentCoords(): Promise<Coords> {
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

/**
 * Verify the device is within range of a gym. Gyms without coordinates can't
 * be verified, so we allow those through.
 */
export async function assertNearGym(gym: {
  latitude: number | null;
  longitude: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (gym.latitude == null || gym.longitude == null) return { ok: true };
  try {
    const me = await getCurrentCoords();
    const miles = milesBetween(me.lat, me.lng, gym.latitude, gym.longitude);
    if (miles > MAX_HOME_GYM_MILES) {
      return {
        ok: false,
        error: `You're about ${Math.round(miles)} mi away. Get within ${MAX_HOME_GYM_MILES} mi of the gym to set it as home.`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Location check failed." };
  }
}
