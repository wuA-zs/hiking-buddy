import { requireNativeModule } from 'expo-modules-core';

export interface NativePosition {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  timestamp: number;
}

export async function getNativePosition(): Promise<NativePosition> {
  return requireNativeModule('ExpoAmapLocation').getCurrentPosition();
}
