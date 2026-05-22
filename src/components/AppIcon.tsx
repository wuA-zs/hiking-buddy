import React from "react";
import { Image, ImageSourcePropType, StyleSheet } from "react-native";

interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
}

const ICONS: Record<string, ImageSourcePropType> = {
  "alert-circle-outline": require("../../assets/walking-buddy/alert.png"),
  "arrow-back": require("../../assets/walking-buddy/back.png"),
  "camera-outline": require("../../assets/walking-buddy/camera.png"),
  "chatbubble-ellipses-outline": require("../../assets/walking-buddy/chat.png"),
  "checkmark-circle-outline": require("../../assets/walking-buddy/check.png"),
  "chevron-down": require("../../assets/walking-buddy/chevron-down.png"),
  "chevron-forward-outline": require("../../assets/walking-buddy/chevron-right.png"),
  "chevron-up": require("../../assets/walking-buddy/chevron-up.png"),
  "extension-puzzle-outline": require("../../assets/walking-buddy/sparkle.png"),
  "flash-outline": require("../../assets/walking-buddy/bolt.png"),
  "globe-outline": require("../../assets/walking-buddy/globe.png"),
  "hardware-chip-outline": require("../../assets/walking-buddy/chip.png"),
  "key-outline": require("../../assets/walking-buddy/key.png"),
  "leaf-outline": require("../../assets/walking-buddy/leaf.png"),
  "map-outline": require("../../assets/walking-buddy/map.png"),
  "navigate-outline": require("../../assets/walking-buddy/navigate.png"),
  "person-circle-outline": require("../../assets/walking-buddy/person.png"),
  "person-outline": require("../../assets/walking-buddy/person.png"),
  "pin-outline": require("../../assets/walking-buddy/pin.png"),
  "refresh-outline": require("../../assets/walking-buddy/refresh.png"),
  send: require("../../assets/walking-buddy/send.png"),
  "settings-outline": require("../../assets/walking-buddy/settings.png"),
  "sparkles-outline": require("../../assets/walking-buddy/sparkle.png"),
  "time-outline": require("../../assets/walking-buddy/clock.png"),
  "trash-outline": require("../../assets/walking-buddy/trash.png"),
  "volume-high": require("../../assets/walking-buddy/volume.png"),
  "volume-mute": require("../../assets/walking-buddy/mute.png"),
};

export function AppIcon({ name, size = 18, color = "#000" }: AppIconProps) {
  return (
    <Image
      accessibilityElementsHidden
      importantForAccessibility="no"
      source={ICONS[name] ?? ICONS["pin-outline"]}
      style={[styles.icon, { width: size, height: size, tintColor: color }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    flexShrink: 0,
  },
});
