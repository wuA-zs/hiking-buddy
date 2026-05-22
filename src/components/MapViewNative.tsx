import React, { Component, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { POI } from "../services/maps";
import { useTheme, Spacing, FontSize } from "../lib/theme";
import { NativeAmapView } from "../../modules/expo-amap-view/src";
import { getAmapKey } from "../lib/config";
import { AppIcon } from "./AppIcon";

interface Props {
  lat?: number;
  lng?: number;
  pois: POI[];
  onPOITap?: (poi: POI) => void;
}

class MapErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[MapViewNative] render error:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <AppIcon name="map-outline" size={32} color="#999" />
          <Text style={styles.fallbackText}>地图加载失败</Text>
          <Text style={styles.fallbackHint}>请检查高德地图 Key 配置</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function MapViewInner({ lat, lng, pois, onPOITap }: Props) {
  const { colors: Colors } = useTheme();
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    getAmapKey().then(setApiKey);
  }, []);

  if (!lat || !lng) {
    return (
      <View style={[styles.placeholder, { backgroundColor: Colors.surfaceAlt }]}>
        <AppIcon name="map-outline" size={32} color={Colors.textTertiary} />
        <Text style={[styles.placeholderText, { color: Colors.textTertiary }]}>定位中...</Text>
      </View>
    );
  }

  if (!apiKey) {
    return (
      <View style={[styles.placeholder, { backgroundColor: Colors.surfaceAlt }]}>
        <AppIcon name="map-outline" size={32} color={Colors.textTertiary} />
        <Text style={[styles.placeholderText, { color: Colors.textTertiary }]}>
          配置高德 Key 后显示地图
        </Text>
      </View>
    );
  }

  const markers = pois.map((poi) => ({
    id: poi.id,
    name: poi.name,
    type: poi.type,
    latitude: poi.latitude,
    longitude: poi.longitude,
    address: poi.address,
    distance: poi.distance,
    direction: poi.direction,
  }));

  return (
    <NativeAmapView
      style={styles.map}
      apiKey={apiKey}
      initialCenter={{ latitude: lat, longitude: lng }}
      zoomLevel={15}
      markers={markers}
      showsUserLocation={true}
      onMarkerTap={(event) => {
        const poi = event.nativeEvent;
        onPOITap?.({
          id: poi.id,
          name: poi.name,
          type: poi.type ?? "",
          latitude: poi.latitude,
          longitude: poi.longitude,
          address: poi.address ?? "",
          distance: poi.distance ?? 0,
          direction: poi.direction ?? "",
        });
      }}
    />
  );
}

export function MapViewNative(props: Props) {
  return (
    <MapErrorBoundary>
      <MapViewInner {...props} />
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
  },
  placeholderText: {
    fontSize: FontSize.sm,
  },
  fallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f5f5",
  },
  fallbackText: {
    fontSize: 14,
    color: "#666",
  },
  fallbackHint: {
    fontSize: 12,
    color: "#999",
  },
});
