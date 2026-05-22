import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, Text, ToastAndroid, StyleSheet, View } from "react-native";
import { AGenUIView, copyTextToClipboard, type AGenUIActionEvent, type AGenUIErrorEvent } from "expo-agenui";
import type { AGenUIContent } from "../agent/types";
import { useTheme, Spacing, FontSize, Radius } from "../lib/theme";

interface Props {
  content: AGenUIContent;
  onAction?: (event: AGenUIActionEvent) => void;
}

export function AGenUIBubble({ content, onAction }: Props) {
  const { colors: Colors } = useTheme();
  const [nativeError, setNativeError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      return JSON.parse(content.payload);
    } catch {
      return null;
    }
  }, [content.payload]);

  const canUseNativeAGenUI = useMemo(() => isNativeAGenUIPayload(parsed), [parsed]);

  if (!parsed) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>AGenUI</Text>
        <Text style={[styles.error, { color: Colors.warning }]} numberOfLines={3}>
          Invalid AGenUI payload
        </Text>
      </View>
    );
  }

  if (!canUseNativeAGenUI) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>AGenUI</Text>
        <Text style={[styles.error, { color: Colors.warning }]} numberOfLines={4}>
          Unsupported AGenUI payload. Expected official A2UI v0.9 messages: createSurface, updateComponents, or updateDataModel.
        </Text>
      </View>
    );
  }

  function handleNativeError(event: { nativeEvent: AGenUIErrorEvent }) {
    setNativeError(event.nativeEvent.message);
  }

  async function handleCopyPayload() {
    const ok = await copyTextToClipboard(formatJsonForCopy(parsed, content.payload));
    if (Platform.OS === "android") {
      ToastAndroid.show(ok ? "已复制 AGenUI payload" : "复制失败", ToastAndroid.SHORT);
    } else {
      Alert.alert(ok ? "已复制" : "复制失败", ok ? "AGenUI payload 已复制" : "当前平台不支持复制");
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors.textTertiary }]}>AGenUI</Text>
        <Pressable
          onPress={handleCopyPayload}
          hitSlop={8}
          style={({ pressed }) => [
            styles.copyButton,
            { borderColor: Colors.border, backgroundColor: pressed ? Colors.surfaceAlt : Colors.elevated },
          ]}
          accessibilityRole="button"
          accessibilityLabel="复制 AGenUI payload"
        >
          <Text style={[styles.copyText, { color: Colors.textSecondary }]}>复制</Text>
        </Pressable>
      </View>
      <AGenUIView
        payload={JSON.stringify(parsed)}
        colorScheme={Colors.bg === "#0F172A" ? "dark" : "light"}
        onAction={(event) => onAction?.(event.nativeEvent)}
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

function formatJsonForCopy(value: unknown, fallback: string): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

function isNativeAGenUIPayload(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(isNativeAGenUIPayload);
  }
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return "createSurface" in record || "updateComponents" in record || "updateDataModel" in record || "deleteSurface" in record;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    overflow: "hidden",
  },
  title: {
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  copyButton: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  copyText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
  error: {
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  nativeSurface: {
    width: "100%",
    minHeight: 96,
  },
});
