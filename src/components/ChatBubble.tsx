import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { AgentMessage } from "../agent/types";
import { Colors, Spacing, FontSize, Radius, Shadows, getToolCallLabel, formatTime } from "../lib/theme";

interface Props {
  message: AgentMessage;
}

export function ChatBubble({ message }: Props) {
  if (message.role === "user") {
    const text = message.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");

    return (
      <View style={styles.userRow}>
        <LinearGradient
          colors={Colors.bubbleUserGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubble}
        >
          <Text style={styles.userText}>{text}</Text>
        </LinearGradient>
        <Text style={styles.timeUser}>{formatTime(message.timestamp)}</Text>
      </View>
    );
  }

  if (message.role === "assistant") {
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
            {text ? <Text style={styles.assistantText}>{text}</Text> : null}
            {toolCalls.map((tc) => (
              <View key={tc.id} style={styles.toolCall}>
                <Text style={styles.toolCallText}>{getToolCallLabel(tc.name)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.timeAssistant}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  userRow: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
    marginVertical: Spacing.xs,
    maxWidth: "82%",
  },
  userBubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderBottomRightRadius: Spacing.xs,
    ...Shadows.sm,
  },
  userText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  timeUser: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
    marginRight: Spacing.sm,
  },
  assistantRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "flex-start",
    marginVertical: Spacing.xs,
    maxWidth: "88%",
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
  assistantText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 22,
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
  timeAssistant: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
    marginLeft: Spacing.sm,
  },
});
