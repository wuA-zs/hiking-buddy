import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { POI } from "../services/maps";
import { Colors, Spacing, FontSize } from "../lib/theme";

interface Props {
  lat?: number;
  lng?: number;
  pois: POI[];
  onPOITap?: (poi: POI) => void;
}

export function MapViewNative({ lat, lng, pois, onPOITap }: Props) {
  if (!lat || !lng) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="map-outline" size={32} color={Colors.textTertiary} />
        <Text style={styles.placeholderText}>定位中...</Text>
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
      scrollEnabled={false}
      zoomEnabled={false}
    >
      {pois.map((poi, i) => (
        <Marker
          key={i}
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
    color: Colors.textTertiary,
  },
});
