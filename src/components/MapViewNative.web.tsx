import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { POI } from "../services/maps";
import { useTheme, Spacing, FontSize } from "../lib/theme";

interface Props {
  lat?: number;
  lng?: number;
  pois?: POI[];
  onPOITap?: (poi: POI) => void;
}

export function MapViewNative(_props: Props) {
  const { colors: Colors } = useTheme();
  return (
    <View style={[styles.placeholder, { backgroundColor: Colors.surfaceAlt }]}>
      <Ionicons name="map-outline" size={32} color={Colors.textTertiary} />
      <Text style={[styles.placeholderText, { color: Colors.textTertiary }]}>地图仅在 App 中可用</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
  },
  placeholderText: {
    fontSize: FontSize.sm,
  },
});
