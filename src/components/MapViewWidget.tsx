import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../lib/theme";
import { requestPermission, getCurrentPosition, startWatching, stopWatching, type Position } from "../services/location";
import { reverseGeocode, searchNearby, type POI, type Address } from "../services/maps";
import { MapViewNative } from "./MapViewNative";

interface Props {
  onLocationTap: (lat: number, lng: number, address: string) => void;
  onPOITap?: (poi: POI) => void;
}

const isWeb = Platform.OS === "web";

export function MapViewWidget({ onLocationTap, onPOITap }: Props) {
  const { colors: Colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const expandAnim = useState(new Animated.Value(0))[0];

  // Start watching position
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const granted = await requestPermission();
        if (!granted) {
          if (mounted) {
            setLoading(false);
            setError("位置权限未授予");
          }
          return;
        }
        if (!mounted) return;

        const pos = await getCurrentPosition();
        if (!mounted) return;

        setPosition(pos);
        setLoading(false);
        setError(null);

        const [addr, poiList] = await Promise.all([
          reverseGeocode(pos.latitude, pos.longitude).catch(() => null),
          searchNearby(pos.latitude, pos.longitude, undefined, 1000).catch(() => []),
        ]);
        if (mounted) {
          if (addr) setAddress(addr);
          setPois(poiList);
        }
      } catch (err) {
        if (mounted) {
          setLoading(false);
          setError(err instanceof Error ? err.message : "定位失败");
        }
      }
    })();

    startWatching((pos) => {
      if (mounted) {
        setPosition(pos);
        setError(null);
      }
    }).catch(() => { /* ignore watch errors */ });

    return () => {
      mounted = false;
      stopWatching();
    };
  }, []);

  // Animate expand/collapse
  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }, [expanded]);

  const mapHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280],
  });

  const handleBarPress = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  const handleShareLocation = useCallback(() => {
    if (!position) return;
    const addrText = address?.formatted ?? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`;
    onLocationTap(position.latitude, position.longitude, addrText);
  }, [position, address, onLocationTap]);

  const locationText = error
    ? error
    : loading
      ? "获取位置中..."
      : address?.formatted
        ? address.formatted
        : position
          ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
          : "定位不可用";

  return (
    <View style={[styles.container, { backgroundColor: Colors.surface, borderBottomColor: Colors.divider }]}>
      {/* Collapsed bar — always visible */}
      <TouchableOpacity style={[styles.bar, { backgroundColor: Colors.mapExpandBg }]} onPress={handleBarPress} activeOpacity={0.7}>
        <View style={styles.barLeft}>
          <Ionicons name="location" size={16} color={Colors.primary} />
          <Text style={[styles.barText, { color: Colors.textSecondary }]} numberOfLines={1}>
            {locationText}
          </Text>
        </View>
        <View style={styles.barRight}>
          <TouchableOpacity onPress={handleShareLocation} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={Colors.textTertiary}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded map area */}
      <Animated.View style={[styles.mapArea, { maxHeight: mapHeight }]}>
        {expanded && (
          <>
            {/* Map visual */}
            <View style={[styles.mapVisual, { backgroundColor: Colors.surfaceAlt }]}>
              {isWeb ? (
                <WebMap lat={position?.latitude} lng={position?.longitude} pois={pois} />
              ) : (
                <MapViewNative lat={position?.latitude} lng={position?.longitude} pois={pois} onPOITap={onPOITap} />
              )}
            </View>

            {/* POI list */}
            {pois.length > 0 && (
              <View style={styles.poiList}>
                {pois.slice(0, 3).map((poi) => (
                  <TouchableOpacity
                    key={poi.id}
                    style={[styles.poiCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                    onPress={() => onPOITap?.(poi)}
                  >
                    <Ionicons name="pin" size={12} color={Colors.primary} />
                    <Text style={[styles.poiName, { color: Colors.textPrimary }]} numberOfLines={1}>{poi.name}</Text>
                    <Text style={[styles.poiDist, { color: Colors.primary }]}>{poi.distance}m</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

// ── Web fallback: Amap static map ────────────────────────────

function WebMap({ lat, lng, pois }: { lat?: number; lng?: number; pois: POI[] }) {
  const { colors: Colors } = useTheme();
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    import("../lib/config").then(({ getAmapKey }) => {
      getAmapKey().then((k) => k && setApiKey(k));
    });
  }, []);

  if (!lat || !lng) {
    return (
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={32} color={Colors.textTertiary} />
        <Text style={[styles.mapPlaceholderText, { color: Colors.textTertiary }]}>定位中...</Text>
      </View>
    );
  }

  if (!apiKey) {
    return (
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={32} color={Colors.primary} />
        <Text style={[styles.mapPlaceholderText, { color: Colors.textTertiary }]}>配置高德 Key 后显示地图</Text>
        <Text style={[styles.mapCoords, { color: Colors.textTertiary }]}>{lat.toFixed(4)}, {lng.toFixed(4)}</Text>
      </View>
    );
  }

  const markers = `mid,0x1,pin,${lng},${lat}`;
  const poiMarkers = pois.slice(0, 5).map((p) => `small,0x2d6a4f,pin,${p.longitude},${p.latitude}`).join("|");
  const allMarkers = poiMarkers ? `${markers}|${poiMarkers}` : markers;
  const url = `https://restapi.amap.com/v3/staticmap?location=${lng},${lat}&zoom=15&size=600*300&markers=${encodeURIComponent(allMarkers)}&key=${apiKey}`;

  return <Image source={{ uri: url }} style={styles.mapImage} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  barLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm,
  },
  barText: {
    fontSize: FontSize.sm,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  barRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  shareBtn: {
    padding: Spacing.xs,
  },
  mapArea: {
    overflow: "hidden",
  },
  mapVisual: {
    height: 200,
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
  },
  mapPlaceholderText: {
    fontSize: FontSize.sm,
  },
  mapCoords: {
    fontSize: FontSize.xs,
    fontFamily: "monospace",
  },
  poiList: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    overflow: "hidden",
  },
  poiCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    ...Shadows.sm,
  },
  poiName: {
    fontSize: FontSize.xs,
    marginLeft: 4,
    maxWidth: 80,
  },
  poiDist: {
    fontSize: FontSize.xs,
    marginLeft: 4,
    fontWeight: "600",
  },
});
