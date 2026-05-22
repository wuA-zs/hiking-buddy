import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import type { AgentMessage } from "../agent/types";
import type { AGenUIActionEvent } from "expo-agenui";
import { useTheme, Spacing, FontSize, Radius, formatTime } from "../lib/theme";
import { AssistantBubble } from "./AssistantBubble";
import { AGenUIBubble } from "./AGenUIBubble";

interface Props {
  message: AgentMessage;
  onAGenUIAction?: (event: AGenUIActionEvent) => void;
}

export function ChatBubble({ message, onAGenUIAction }: Props) {
  const { colors: Colors } = useTheme();

  if (message.role === "user") {
    const text = message.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    const images = message.content.filter((c): c is { type: "image"; data: string; mimeType: string } => c.type === "image");

    return (
      <View style={styles.userRow} accessibilityLabel={`你说：${text}`}>
        <View style={[styles.userBubble, { backgroundColor: Colors.bubbleUser }, images.length > 0 && styles.userBubbleWithImage]}>
          {images.map((img, i) => (
            <Image
              key={i}
              source={{ uri: `data:${img.mimeType};base64,${img.data}` }}
              style={styles.userImage}
              resizeMode="cover"
              accessibilityLabel="你拍摄的照片"
            />
          ))}
          {text ? <Text style={[styles.userText, { color: Colors.textOnPrimary }]}>{text}</Text> : null}
        </View>
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
      <View accessibilityLabel={`走走搭子说：${text}`}>
        <AssistantBubble toolCalls={toolCalls}>
          {message.content.map((content, index) => {
            if (content.type === "text") {
              return content.text ? (
                <Text key={`${message.id}-text-${index}`} style={[styles.assistantText, { color: Colors.textPrimary }]}>
                  {content.text}
                </Text>
              ) : null;
            }
            if (content.type === "agenui") {
              return <AGenUIBubble key={content.id} content={content} onAction={onAGenUIAction} />;
            }
            return null;
          })}
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
    borderBottomRightRadius: Radius.sm,
  },
  userBubbleWithImage: {
    padding: Spacing.xs,
  },
  userImage: {
    width: 184,
    height: 184,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  userText: {
    fontSize: FontSize.md,
    lineHeight: 23,
  },
  assistantText: {
    fontSize: FontSize.md,
    lineHeight: 23,
  },
  timeUser: {
    fontSize: FontSize.xs,
    marginTop: 2,
    marginRight: Spacing.sm,
  },
  timeAssistant: {
    fontSize: FontSize.xs,
    marginTop: 2,
    marginLeft: 50,
  },
});
