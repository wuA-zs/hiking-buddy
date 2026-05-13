import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, FontSize, Radius, Shadows } from "../lib/theme";

interface Props {
  onSend: (text: string) => void;
  onPhoto: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onPhoto, disabled }: Props) {
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
    <View style={styles.container}>
      <TouchableOpacity style={styles.photoButton} onPress={onPhoto} disabled={disabled}>
        <Ionicons name="camera-outline" size={22} color={Colors.primary} />
      </TouchableOpacity>

      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <TextInput
          style={styles.input}
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

      <TouchableOpacity onPress={handleSend} disabled={!canSend} activeOpacity={0.7}>
        <LinearGradient
          colors={canSend ? Colors.bubbleUserGradient : ["#ccc", "#bbb"]}
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
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  photoButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryAlpha20,
    marginBottom: Spacing.xs,
  },
  inputWrap: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.xl,
    marginHorizontal: Spacing.sm,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...Shadows.sm,
  },
  inputWrapFocused: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    maxHeight: 110,
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
