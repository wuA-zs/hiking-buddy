import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { POI } from "../services/maps";
import { useTheme, Spacing, FontSize } from "../lib/theme";

interface Props {
  lat?: number;
  lng?: number;
  pois: POI[];
  onPOITap?: (poi: POI) => void;
}

export function MapViewNative({ lat, lng, pois, onPOITap }: Props) {
  const { colors: Colors } = useTheme();

  if (!lat || !lng) {
    return (
      <View style={[styles.placeholder, { backgroundColor: Colors.surfaceAlt }]}>
        <Ionicons name="map-outline" size={32} color={Colors.textTertiary} />
        <Text style={[styles.placeholderText, { color: Colors.textTertiary }]}>定位中...</Text>
      </View>
    );
  }

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation
      showsMyLocationButton={false}
      scrollEnabled
      zoomEnabled
      pitchEnabled={false}
      rotateEnabled={false}
    >
      {pois.map((poi) => (
        <Marker
          key={poi.id}
          coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
          title={poi.name}
          description={`${poi.distance}m · ${poi.address}`}
          onPress={() => onPOITap?.(poi)}
        />
      ))}
    </MapView>
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
});
