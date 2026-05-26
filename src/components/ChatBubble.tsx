import React from "react";
import { Alert, Image, Platform, Pressable, StyleSheet, Text, ToastAndroid, View } from "react-native";
import type { AgentMessage } from "../agent/types";
import { copyTextToClipboard, type AGenUIActionEvent } from "expo-agenui";
import { useTheme, Spacing, FontSize, Radius, formatTime } from "../lib/theme";
import { AssistantBubble } from "./AssistantBubble";
import { AGenUIBubble } from "./AGenUIBubble";

interface Props {
  message: AgentMessage;
  onAGenUIAction?: (event: AGenUIActionEvent) => void;
}

export function ChatBubble({ message, onAGenUIAction }: Props) {
  const { colors: Colors } = useTheme();
  const copyText = getCopyText(message);

  async function handleCopy() {
    const ok = await copyTextToClipboard(copyText);
    if (Platform.OS === "android") {
      ToastAndroid.show(ok ? "已复制气泡内容" : "复制失败", ToastAndroid.SHORT);
    } else {
      Alert.alert(ok ? "已复制" : "复制失败", ok ? "气泡内容已复制" : "当前平台不支持复制");
    }
  }

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
        <View style={styles.userMetaRow}>
          <Pressable onPress={handleCopy} hitSlop={8} accessibilityRole="button" accessibilityLabel="复制气泡内容">
            <Text style={[styles.copyMeta, { color: Colors.textTertiary }]}>复制</Text>
          </Pressable>
          <Text style={[styles.timeUser, { color: Colors.textTertiary }]}>{formatTime(message.timestamp)}</Text>
        </View>
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
                  {formatDisplayText(content.text)}
                </Text>
              ) : null;
            }
            if (content.type === "agenui") {
              return <AGenUIBubble key={content.id} content={content} onAction={onAGenUIAction} />;
            }
            return null;
          })}
        </AssistantBubble>
        <View style={styles.assistantMetaRow}>
          <Text style={[styles.timeAssistant, { color: Colors.textTertiary }]}>{formatTime(message.timestamp)}</Text>
          <Pressable onPress={handleCopy} hitSlop={8} accessibilityRole="button" accessibilityLabel="复制气泡内容">
            <Text style={[styles.copyMeta, { color: Colors.textTertiary }]}>复制</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return null;
}

function getCopyText(message: AgentMessage): string {
  if (message.role === "user") {
    return message.content
      .map((content) => {
        if (content.type === "text") return content.text;
        return `[image:${content.mimeType}]`;
      })
      .filter(Boolean)
      .join("\n");
  }

  if (message.role === "assistant") {
    return message.content
      .map((content) => {
        if (content.type === "text") return content.text;
        if (content.type === "agenui") return `AGenUI payload:\n${content.payload}`;
        if (content.type === "toolCall") return `[tool:${content.name}] ${JSON.stringify(content.arguments)}`;
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return message.content.map((content) => content.text).join("\n");
}

function formatDisplayText(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
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
  },
  timeAssistant: {
    fontSize: FontSize.xs,
  },
  userMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
    marginRight: Spacing.sm,
  },
  assistantMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
    marginLeft: 50,
  },
  copyMeta: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
});
