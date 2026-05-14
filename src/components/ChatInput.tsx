import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../lib/theme";

interface Props {
  onSend: (text: string) => void;
  onPhoto: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onPhoto, disabled }: Props) {
  const { colors: Colors } = useTheme();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={[styles.container, { backgroundColor: Colors.surface, borderTopColor: Colors.divider }]}>
      <TouchableOpacity style={[styles.photoButton, { backgroundColor: Colors.primaryAlpha20 }]} onPress={onPhoto} disabled={disabled} accessibilityLabel="拍照" accessibilityRole="button">
        <Ionicons name="camera-outline" size={22} color={Colors.primary} />
      </TouchableOpacity>

      <View style={[
        styles.inputWrap,
        focused ? { ...styles.inputWrapFocused, borderColor: Colors.primaryLight, backgroundColor: Colors.surface } : { backgroundColor: Colors.surfaceAlt, borderColor: "transparent" },
      ]}>
        <TextInput
          style={[styles.input, { color: Colors.textPrimary }]}
          value={text}
          onChangeText={setText}
          placeholder="问问小Pi..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={2000}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit
        />
      </View>

      <TouchableOpacity onPress={handleSend} disabled={!canSend} activeOpacity={0.7} accessibilityLabel="发送消息" accessibilityRole="button">
        <LinearGradient
          colors={canSend ? Colors.bubbleUserGradient : ["#d1d5db", "#d1d5db"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sendButton}
        >
          {disabled ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
  },
  photoButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  inputWrap: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: Radius.xl,
    marginHorizontal: Spacing.sm,
    borderWidth: 1.5,
    ...Shadows.sm,
  },
  inputWrapFocused: {
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    maxHeight: 110,
    textAlignVertical: "top",
  },
  sendButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
    ...Shadows.md,
  },
});
