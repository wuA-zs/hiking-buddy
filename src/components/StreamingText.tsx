import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import type { AssistantMessage } from "../agent/types";
import { useTheme, FontSize } from "../lib/theme";
import { AssistantBubble } from "./AssistantBubble";

interface Props {
  message: AssistantMessage | undefined;
}

export function StreamingText({ message }: Props) {
  const { colors: Colors } = useTheme();
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
    <AssistantBubble toolCalls={toolCalls}>
      {message.content.map((content, index) => {
        if (content.type === "text") {
          return content.text ? (
            <View key={`${message.id}-text-${index}`} style={styles.textRow}>
              <Text style={[styles.assistantText, { color: Colors.textPrimary }]}>{formatDisplayText(content.text)}</Text>
              <Animated.Text style={[styles.cursor, { opacity: cursorOpacity, color: Colors.primary }]}>|</Animated.Text>
            </View>
          ) : null;
        }
        return null;
      })}
    </AssistantBubble>
  );
}

function formatDisplayText(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

const styles = StyleSheet.create({
  textRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  assistantText: {
    fontSize: FontSize.md,
    lineHeight: 22,
    flex: 1,
  },
  cursor: {
    fontSize: FontSize.lg,
    fontWeight: "300",
    marginLeft: 1,
  },
});
