import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, Spacing, FontSize, Radius, Shadows, getToolCallLabel } from "../lib/theme";
import type { ToolCall } from "../agent/types";

interface Props {
  children?: React.ReactNode;
  toolCalls?: ToolCall[];
}

/**
 * Shared assistant bubble layout — avatar + bubble with optional tool calls.
 * Used by both ChatBubble and StreamingText to avoid style duplication.
 */
export function AssistantBubble({ children, toolCalls }: Props) {
  const { colors: Colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: Colors.primaryAlpha20 }]}>
        <Text style={[styles.avatarText, { color: Colors.primary }]}>Pi</Text>
      </View>
      <View style={styles.content}>
        <View style={[styles.bubble, { backgroundColor: Colors.bubbleAssistant, borderColor: Colors.bubbleAssistantBorder }]}>
          {children}
          {toolCalls?.map((tc) => (
            <View key={tc.id} style={[styles.toolCall, { backgroundColor: Colors.toolCallBg, borderColor: Colors.toolCallBorder }]}>
              <Text style={[styles.toolCallText, { color: Colors.primary }]}>{getToolCallLabel(tc.name)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
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
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  avatarText: {
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  bubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: Spacing.xs,
    borderWidth: 1,
    ...Shadows.sm,
  },
  toolCall: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  toolCallText: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
});
