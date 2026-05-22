import { requireNativeViewManager } from "expo-modules-core";
import type { AmapViewProps } from "./AmapView.types";

export const NativeAmapView = requireNativeViewManager<AmapViewProps>("ExpoAmapView");

export type { AmapViewProps, POIMarker } from "./AmapView.types";
