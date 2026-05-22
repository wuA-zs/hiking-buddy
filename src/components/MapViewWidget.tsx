import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform } from "react-native";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../lib/theme";
import { requestPermission, getCurrentPosition, startWatching, stopWatching, type Position } from "../services/location";
import { reverseGeocode, searchNearby, type POI, type Address } from "../services/maps";
import { MapViewNative } from "./MapViewNative";
import { AppIcon } from "./AppIcon";

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

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const granted = await requestPermission();
        if (!granted) {
          if (mounted) {
            setLoading(false);
            setError("位置权限未开启");
          }
          return;
        }

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
    }).catch(() => undefined);

    return () => {
      mounted = false;
      stopWatching();
    };
  }, []);

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
      tension: 70,
      friction: 12,
    }).start();
  }, [expanded, expandAnim]);

  const mapHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 300],
  });

  const handleShareLocation = useCallback(() => {
    if (!position) return;
    const addrText = address?.formatted ?? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`;
    onLocationTap(position.latitude, position.longitude, addrText);
  }, [position, address, onLocationTap]);

  const locationText = error
    ? error
    : loading
      ? "正在获取当前位置..."
      : address?.formatted
        ? address.formatted
        : position
          ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
          : "当前位置不可用";

  return (
    <View style={[styles.outer, { backgroundColor: Colors.bg }]}>
      <View style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <TouchableOpacity style={styles.summary} onPress={() => setExpanded((value) => !value)} activeOpacity={0.75}>
          <View style={[styles.locationIcon, { backgroundColor: Colors.primaryAlpha12 }]}>
            <AppIcon name="navigate-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.summaryText}>
            <Text style={[styles.eyebrow, { color: Colors.textTertiary }]}>当前位置</Text>
            <Text style={[styles.locationText, { color: Colors.textPrimary }]} numberOfLines={1}>
              {locationText}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleShareLocation}
            style={[styles.actionButton, { backgroundColor: Colors.primaryAlpha12 }]}
            disabled={!position}
            accessibilityLabel="分享当前位置给 AI"
            accessibilityRole="button"
          >
            <AppIcon name="chatbubble-ellipses-outline" size={17} color={Colors.primary} />
          </TouchableOpacity>
          <AppIcon name={expanded ? "chevron-up" : "chevron-down"} size={19} color={Colors.textTertiary} />
        </TouchableOpacity>

        <Animated.View style={[styles.mapArea, { maxHeight: mapHeight }]}>
          {expanded && (
            <>
              <View style={[styles.mapVisual, { backgroundColor: Colors.surfaceAlt }]}>
                {isWeb ? (
                  <WebMap lat={position?.latitude} lng={position?.longitude} pois={pois} />
                ) : (
                  <MapViewNative lat={position?.latitude} lng={position?.longitude} pois={pois} onPOITap={onPOITap} />
                )}
              </View>

              {pois.length > 0 && (
                <View style={styles.poiList}>
                  {pois.slice(0, 3).map((poi) => (
                    <TouchableOpacity
                      key={poi.id}
                      style={[styles.poiCard, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}
                      onPress={() => onPOITap?.(poi)}
                    >
                      <AppIcon name="pin-outline" size={13} color={Colors.primary} />
                      <Text style={[styles.poiName, { color: Colors.textPrimary }]} numberOfLines={1}>
                        {poi.name}
                      </Text>
                      <Text style={[styles.poiDist, { color: Colors.primary }]}>{poi.distance}m</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

function WebMap({ lat, lng, pois }: { lat?: number; lng?: number; pois: POI[] }) {
  const { colors: Colors } = useTheme();
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    import("../lib/config").then(({ getAmapKey }) => {
      getAmapKey().then((key) => key && setApiKey(key));
    });
  }, []);

  if (!lat || !lng) {
    return (
      <View style={styles.mapPlaceholder}>
        <AppIcon name="map-outline" size={32} color={Colors.textTertiary} />
        <Text style={[styles.mapPlaceholderText, { color: Colors.textTertiary }]}>定位中...</Text>
      </View>
    );
  }

  if (!apiKey) {
    return (
      <View style={styles.mapPlaceholder}>
        <AppIcon name="map-outline" size={32} color={Colors.primary} />
        <Text style={[styles.mapPlaceholderText, { color: Colors.textTertiary }]}>配置高德 Key 后显示地图</Text>
        <Text style={[styles.mapCoords, { color: Colors.textTertiary }]}>
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </Text>
      </View>
    );
  }

  const markers = `mid,0x1,pin,${lng},${lat}`;
  const poiMarkers = pois.slice(0, 5).map((p) => `small,0x2f6f4e,pin,${p.longitude},${p.latitude}`).join("|");
  const allMarkers = poiMarkers ? `${markers}|${poiMarkers}` : markers;
  const url = `https://restapi.amap.com/v3/staticmap?location=${lng},${lat}&zoom=15&size=600*300&markers=${encodeURIComponent(allMarkers)}&key=${apiKey}`;

  return <Image source={{ uri: url }} style={styles.mapImage} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    overflow: "hidden",
    ...Shadows.sm,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    marginBottom: 2,
  },
  locationText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  mapArea: {
    overflow: "hidden",
  },
  mapVisual: {
    height: 210,
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
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  poiName: {
    fontSize: FontSize.xs,
    marginLeft: 4,
    maxWidth: 80,
  },
  poiDist: {
    fontSize: FontSize.xs,
    marginLeft: 4,
    fontWeight: "700",
  },
});
