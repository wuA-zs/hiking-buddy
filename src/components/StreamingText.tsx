import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import type { AssistantMessage } from "../agent/types";
import { Colors, Spacing, FontSize, Radius, Shadows, getToolCallLabel } from "../lib/theme";

interface Props {
  message: AssistantMessage | undefined;
}

export function StreamingText({ message }: Props) {
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  if (!message) return null;

  const text = message.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");

  const toolCalls = message.content.filter((c) => c.type === "toolCall");

  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>Pi</Text>
      </View>
      <View style={styles.assistantContent}>
        <View style={styles.assistantBubble}>
          {text ? (
            <View style={styles.textRow}>
              <Text style={styles.assistantText}>{text}</Text>
              <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>|</Animated.Text>
            </View>
          ) : null}
          {toolCalls.map((tc) => (
            <View key={tc.id} style={styles.toolCall}>
              <Text style={styles.toolCallText}>{getToolCallLabel(tc.name)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  assistantRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "flex-start",
    marginVertical: Spacing.xs,
    maxWidth: "88%",
    paddingHorizontal: Spacing.md,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryAlpha20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  avatarText: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.primary,
  },
  assistantContent: {
    flex: 1,
  },
  assistantBubble: {
    backgroundColor: Colors.bubbleAssistant,
    borderWidth: 1,
    borderColor: Colors.bubbleAssistantBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: Spacing.xs,
    ...Shadows.sm,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  assistantText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 22,
    flex: 1,
  },
  cursor: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: "300",
    marginLeft: 1,
  },
  toolCall: {
    backgroundColor: Colors.toolCallBg,
    borderWidth: 1,
    borderColor: Colors.toolCallBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  toolCallText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
});
