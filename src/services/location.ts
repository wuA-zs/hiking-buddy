/**
 * Location service — native LocationManager (Android) / expo-location (iOS/web)
 * Includes WGS-84 → GCJ-02 coordinate conversion for China map compatibility
 */

import { Platform } from "react-native";
import * as ExpoLocation from "expo-location";

export interface Position {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

let locationSubscription: ExpoLocation.LocationSubscription | null = null;

// Lazy-load native module — survives require() failures gracefully
let _nativeModule: any | null | undefined;
function getNativeModule() {
  if (_nativeModule === undefined) {
    try {
      // requireNativeModule is called lazily inside getNativePosition(),
      // so this require() succeeds even if the native side is missing.
      // We verify availability by checking requireNativeModule directly.
      const { requireNativeModule } = require("expo-modules-core");
      requireNativeModule("ExpoAmapLocation");
      _nativeModule = require("../../modules/expo-amap-location/src");
    } catch (e) {
      console.warn("[location] Native module NOT available:", e);
      _nativeModule = null;
    }
  }
  return _nativeModule;
}

export async function requestPermission(): Promise<boolean> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentPosition(): Promise<Position> {
  if (Platform.OS === "android") {
    const native = getNativeModule();
    if (native) {
      // Use native LocationManager — works without Google Play Services
      const pos = await native.getNativePosition();
      const [gcjLat, gcjLng] = wgs84ToGcj02(pos.latitude, pos.longitude);
      return {
        latitude: gcjLat,
        longitude: gcjLng,
        altitude: pos.altitude,
        accuracy: pos.accuracy,
        speed: pos.speed,
        heading: pos.heading,
        timestamp: pos.timestamp,
      };
    }
    // Native module unavailable — throw clear error instead of falling back to GMS
    throw new Error("定位模块未加载，请使用开发版构建(development build)安装");
  }

  // iOS / web: use expo-location
  const loc = await ExpoLocation.getCurrentPositionAsync({
    accuracy: ExpoLocation.Accuracy.Balanced,
  });
  const [gcjLat, gcjLng] = wgs84ToGcj02(loc.coords.latitude, loc.coords.longitude);
  return {
    latitude: gcjLat,
    longitude: gcjLng,
    altitude: loc.coords.altitude,
    accuracy: loc.coords.accuracy,
    speed: loc.coords.speed,
    heading: loc.coords.heading,
    timestamp: loc.timestamp,
  };
}

export async function startWatching(
  callback: (position: Position) => void,
  distanceInterval = 200,
): Promise<void> {
  await requestPermission();

  if (Platform.OS === "android") {
    const native = getNativeModule();
    if (native) {
      // Poll-based watching for native module
      const watchInterval = setInterval(async () => {
        try {
          const pos = await native.getNativePosition();
          const [gcjLat, gcjLng] = wgs84ToGcj02(pos.latitude, pos.longitude);
          callback({
            latitude: gcjLat,
            longitude: gcjLng,
            altitude: pos.altitude,
            accuracy: pos.accuracy,
            speed: pos.speed,
            heading: pos.heading,
            timestamp: pos.timestamp,
          });
        } catch {
          // Ignore individual poll failures
        }
      }, 5000);
      locationSubscription = { remove: () => clearInterval(watchInterval) } as any;
      return;
    }
    throw new Error("定位模块未加载，请使用开发版构建(development build)安装");
  }

  locationSubscription = await ExpoLocation.watchPositionAsync(
    {
      accuracy: ExpoLocation.Accuracy.High,
      distanceInterval,
    },
    (loc) => {
      const [gcjLat, gcjLng] = wgs84ToGcj02(loc.coords.latitude, loc.coords.longitude);
      callback({
        latitude: gcjLat,
        longitude: gcjLng,
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

// ── WGS-84 → GCJ-02 Coordinate Conversion ──────────────────
// Standard algorithm for China map offset correction

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x: number, y: number): number {
  let ret =
    -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret =
    300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function wgs84ToGcj02(wgsLat: number, wgsLng: number): [number, number] {
  if (outOfChina(wgsLat, wgsLng)) return [wgsLat, wgsLng];

  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radLat = (wgsLat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);

  return [wgsLat + dLat, wgsLng + dLng];
}
