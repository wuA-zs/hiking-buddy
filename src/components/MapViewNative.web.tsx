import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, FontSize } from "../lib/theme";

interface Props {
  lat?: number;
  lng?: number;
  pois?: any[];
  onPOITap?: (poi: any) => void;
}

export function MapViewNative(_props: Props) {
  return (
    <View style={styles.placeholder}>
      <Ionicons name="map-outline" size={32} color={Colors.textTertiary} />
      <Text style={styles.placeholderText}>地图仅在 App 中可用</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    gap: Spacing.xs,
  },
  placeholderText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
});
