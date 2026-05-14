/**
 * Configuration management — API key, base URL, model storage
 * Uses expo-secure-store on native, localStorage on web
 */

import { Platform } from "react-native";

const KEY_API_KEY = "llm_api_key";
const KEY_BASE_URL = "llm_base_url";
const KEY_MODEL = "llm_model";
const KEY_AMAP_KEY = "amap_api_key";

const DEFAULT_MODEL = "glm-4-flash";

const isNative = Platform.OS !== "web";

let SecureStore: typeof import("expo-secure-store") | null = null;
if (isNative) {
  SecureStore = require("expo-secure-store");
}

async function getItem(key: string): Promise<string | null> {
  if (SecureStore) {
    return SecureStore.getItemAsync(key);
  }
  return localStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (SecureStore) {
    await SecureStore.setItemAsync(key, value);
  } else {
    localStorage.setItem(key, value);
  }
}

export async function getApiKey(): Promise<string | null> {
  return getItem(KEY_API_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await setItem(KEY_API_KEY, key);
}

export async function getBaseUrl(): Promise<string | null> {
  return getItem(KEY_BASE_URL);
}

export async function setBaseUrl(url: string): Promise<void> {
  await setItem(KEY_BASE_URL, url);
}

export async function getModel(): Promise<string> {
  return (await getItem(KEY_MODEL)) || DEFAULT_MODEL;
}

export async function setModel(model: string): Promise<void> {
  await setItem(KEY_MODEL, model);
}

export async function getAmapKey(): Promise<string | null> {
  return getItem(KEY_AMAP_KEY);
}

export async function setAmapKey(key: string): Promise<void> {
  await setItem(KEY_AMAP_KEY, key);
}
