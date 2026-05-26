import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AGenUIView, type AGenUIActionEvent, type AGenUIErrorEvent } from "expo-agenui";
import type { AGenUIContent } from "../agent/types";
import { useTheme, Spacing, FontSize } from "../lib/theme";
import { normalizeAGenUIPayloadForNative } from "../agenui/normalizePayload";

interface Props {
  content: AGenUIContent;
  onAction?: (event: AGenUIActionEvent) => void;
}

export function AGenUIBubble({ content, onAction }: Props) {
  const { colors: Colors, isDark } = useTheme();
  const [nativeError, setNativeError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      return JSON.parse(content.payload);
    } catch {
      return null;
    }
  }, [content.payload]);
  const nativePayload = useMemo(() => normalizeAGenUIPayloadForNative(content.payload), [content.payload]);

  if (!parsed) {
    return (
      <View style={styles.container}>
        <Text style={[styles.error, { color: Colors.warning }]} numberOfLines={3}>
          卡片内容暂时无法显示
        </Text>
      </View>
    );
  }

  if (!isNativeAGenUIPayload(parsed)) {
    return (
      <View style={styles.container}>
        <Text style={[styles.error, { color: Colors.warning }]} numberOfLines={4}>
          这个卡片格式当前版本还不支持
        </Text>
      </View>
    );
  }

  function handleNativeAction(event: { nativeEvent: AGenUIActionEvent }) {
    onAction?.(event.nativeEvent);
  }

  function handleNativeError(event: { nativeEvent: AGenUIErrorEvent }) {
    setNativeError(event.nativeEvent.message);
  }

  return (
    <View style={styles.container}>
      <AGenUIView
        payload={nativePayload}
        colorScheme={isDark ? "dark" : "light"}
        onAction={handleNativeAction}
        onError={handleNativeError}
        style={styles.nativeSurface}
      />

      {nativeError ? (
        <Text style={[styles.error, { color: Colors.warning }]} numberOfLines={4}>
          {nativeError}
        </Text>
      ) : null}
    </View>
  );
}

function isNativeAGenUIPayload(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0 && value.every(isNativeAGenUIPayload);
  return Boolean(isRecord(value) && ("createSurface" in value || "updateComponents" in value || "updateDataModel" in value || "deleteSurface" in value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
    overflow: "hidden",
  },
  nativeSurface: {
    width: "100%",
    minHeight: 96,
  },
  error: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
});
