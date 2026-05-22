import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, Spacing, FontSize, Radius, getToolCallLabel } from "../lib/theme";
import type { ToolCall } from "../agent/types";
import { AppIcon } from "./AppIcon";

interface Props {
  children?: React.ReactNode;
  toolCalls?: ToolCall[];
}

export function AssistantBubble({ children, toolCalls }: Props) {
  const { colors: Colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: Colors.primaryAlpha12 }]}>
        <AppIcon name="leaf-outline" size={16} color={Colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={[styles.bubble, { backgroundColor: Colors.bubbleAssistant, borderColor: Colors.bubbleAssistantBorder }]}>
          {children}
          {toolCalls?.map((tc) => (
            <View key={tc.id} style={[styles.toolCall, { backgroundColor: Colors.toolCallBg, borderColor: Colors.toolCallBorder }]}>
              <AppIcon name="sparkles-outline" size={13} color={Colors.primary} />
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
    maxWidth: "90%",
    paddingHorizontal: Spacing.md,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  bubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: Radius.sm,
    borderWidth: 1,
  },
  toolCall: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  toolCallText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
});
