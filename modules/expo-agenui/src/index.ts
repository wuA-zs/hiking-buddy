import React from "react";
import { Platform, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { requireNativeModule, requireNativeViewManager } from "expo-modules-core";
import type { AGenUIViewProps } from "./AGenUIView.types";

let NativeAGenUIView: React.ComponentType<AGenUIViewProps> | null = null;
let NativeAGenUIModule: { copyToClipboard?: (text: string) => boolean } | null = null;

if (Platform.OS === "android") {
  try {
    NativeAGenUIView = requireNativeViewManager<AGenUIViewProps>("ExpoAGenUI");
  } catch {
    NativeAGenUIView = null;
  }

  try {
    NativeAGenUIModule = requireNativeModule("ExpoAGenUI");
  } catch {
    NativeAGenUIModule = null;
  }
}

export function AGenUIView(props: AGenUIViewProps) {
  if (NativeAGenUIView) {
    return React.createElement(NativeAGenUIView, props);
  }

  return React.createElement(
    View,
    { style: [fallbackStyles.container, props.style as StyleProp<ViewStyle>] },
    React.createElement(Text, { style: fallbackStyles.text }, "Native AGenUI runtime is not available on this platform."),
  );
}

const fallbackStyles = {
  container: {
    minHeight: 96,
    justifyContent: "center" as const,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  text: {
    color: "#4B5563",
    fontSize: 13,
    lineHeight: 18,
  },
};

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (NativeAGenUIModule?.copyToClipboard) {
    return NativeAGenUIModule.copyToClipboard(text);
  }

  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard?.writeText) {
    await clipboard.writeText(text);
    return true;
  }

  return false;
}

export type {
  AGenUIAction,
  AGenUIActionEvent,
  AGenUIErrorEvent,
  AGenUIEventAction,
  AGenUIFunctionCall,
  AGenUIViewProps,
} from "./AGenUIView.types";
