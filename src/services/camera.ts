/**
 * Camera service — expo-image-picker wrapper
 * Includes image resizing for efficient LLM vision calls.
 */

import * as ImagePicker from "expo-image-picker";

/** Maximum dimension for images sent to the LLM (pixels). */
const MAX_IMAGE_DIMENSION = 1024;

export interface PhotoData {
  base64: string;
  mimeType: string;
  uri: string;
  width: number;
  height: number;
}

export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === "granted";
}

export async function takePhoto(): Promise<PhotoData | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  return extractPhotoData(result);
}

export async function pickImage(): Promise<PhotoData | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  return extractPhotoData(result);
}

function extractPhotoData(result: ImagePicker.ImagePickerResult): PhotoData | null {
  const asset = result.assets![0];
  const base64 = asset.base64;
  if (!base64) return null;

  const ext = asset.uri.split(".").pop()?.toLowerCase();
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  return {
    base64,
    mimeType,
    uri: asset.uri,
    width: Math.min(asset.width, MAX_IMAGE_DIMENSION),
    height: Math.min(asset.height, MAX_IMAGE_DIMENSION),
  };
}
