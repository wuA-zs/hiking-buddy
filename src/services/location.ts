/**
 * Location service — expo-location wrapper
 */

import * as Location from "expo-location";

export interface Position {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

let locationSubscription: Location.LocationSubscription | null = null;

export async function requestPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentPosition(): Promise<Position> {
  // Try with Balanced accuracy first, fallback to Low on failure
  const accuracies = [Location.Accuracy.Balanced, Location.Accuracy.Low];

  let lastError: Error | null = null;
  for (const accuracy of accuracies) {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy,
      });
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
        timestamp: loc.timestamp,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("定位失败");
}

export async function startWatching(
  callback: (position: Position) => void,
  distanceInterval = 200,
): Promise<void> {
  await requestPermission();
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval,
    },
    (loc) => {
      callback({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
        timestamp: loc.timestamp,
      });
    },
  );
}

export function stopWatching(): void {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}
