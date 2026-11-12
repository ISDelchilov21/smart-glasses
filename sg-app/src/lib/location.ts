import { requireOptionalNativeModule } from 'expo';

export type Place = { latitude: number; longitude: number; city?: string };

const MAX_AGE_MS = 10 * 60 * 1000;
const GPS_TIMEOUT_MS = 4000;

let cached: { place: Place; time: number } | null = null;

async function loadLocation() {
  if (!requireOptionalNativeModule('ExpoLocation')) {
    return null;
  }
  return import('expo-location');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export async function askLocationPermission() {
  try {
    const Location = await loadLocation();
    await Location?.requestForegroundPermissionsAsync();
  } catch {
    return;
  }
}

export async function currentPlace(): Promise<Place | null> {
  if (cached && Date.now() - cached.time < MAX_AGE_MS) {
    return cached.place;
  }
  try {
    const Location = await loadLocation();
    if (!Location || !(await Location.getForegroundPermissionsAsync()).granted) {
      return null;
    }
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS })) ??
      (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), GPS_TIMEOUT_MS));
    if (!position) {
      return null;
    }
    const { latitude, longitude } = position.coords;
    const addresses = await withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), GPS_TIMEOUT_MS);
    cached = { place: { latitude, longitude, city: addresses?.[0]?.city ?? undefined }, time: Date.now() };
    return cached.place;
  } catch {
    return null;
  }
}
