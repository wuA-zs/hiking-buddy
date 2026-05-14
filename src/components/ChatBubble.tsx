import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { AgentMessage } from "../agent/types";
import { useTheme, Spacing, FontSize, Radius, Shadows, formatTime } from "../lib/theme";
import { AssistantBubble } from "./AssistantBubble";

interface Props {
  message: AgentMessage;
}

export function ChatBubble({ message }: Props) {
  const { colors: Colors } = useTheme();

  if (message.role === "user") {
    const text = message.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    const images = message.content.filter((c): c is { type: "image"; data: string; mimeType: string } => c.type === "image");

    return (
      <View style={styles.userRow} accessibilityLabel={`你说: ${text}`}>
        <LinearGradient
          colors={Colors.bubbleUserGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.userBubble, images.length > 0 && styles.userBubbleWithImage]}
        >
          {images.map((img, i) => (
            <Image
              key={i}
              source={{ uri: `data:${img.mimeType};base64,${img.data}` }}
              style={styles.userImage}
              resizeMode="cover"
              accessibilityLabel="拍摄的照片"
            />
          ))}
          {text ? <Text style={[styles.userText, { color: Colors.textOnPrimary }]}>{text}</Text> : null}
        </LinearGradient>
        <Text style={[styles.timeUser, { color: Colors.textTertiary }]}>{formatTime(message.timestamp)}</Text>
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
      <View accessibilityLabel={`小Pi说: ${text}`}>
        <AssistantBubble toolCalls={toolCalls}>
          {text ? <Text style={[styles.assistantText, { color: Colors.textPrimary }]}>{text}</Text> : null}
        </AssistantBubble>
        <Text style={[styles.timeAssistant, { color: Colors.textTertiary }]}>{formatTime(message.timestamp)}</Text>
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
    marginHorizontal: Spacing.md,
    maxWidth: "82%",
  },
  userBubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderBottomRightRadius: Spacing.xs,
    ...Shadows.sm,
  },
  userBubbleWithImage: {
    padding: Spacing.xs,
  },
  userImage: {
    width: 180,
    height: 180,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  userText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  assistantText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  timeUser: {
    fontSize: FontSize.xs,
    marginTop: 2,
    marginRight: Spacing.sm,
  },
  timeAssistant: {
    fontSize: FontSize.xs,
    marginTop: 2,
    marginLeft: Spacing.xl + Spacing.md + Spacing.sm,
  },
});
