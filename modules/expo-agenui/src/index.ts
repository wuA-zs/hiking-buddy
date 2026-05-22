import React from "react";
import { Platform, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import type { AGenUIViewProps } from "./AGenUIView.types";

let NativeAGenUIView: React.ComponentType<AGenUIViewProps> | null = null;

if (Platform.OS === "android") {
  try {
    NativeAGenUIView = requireNativeViewManager<AGenUIViewProps>("ExpoAGenUI");
  } catch {
    NativeAGenUIView = null;
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

export type {
  AGenUIAction,
  AGenUIActionEvent,
  AGenUIErrorEvent,
  AGenUIEventAction,
  AGenUIFunctionCall,
  AGenUIViewProps,
} from "./AGenUIView.types";
