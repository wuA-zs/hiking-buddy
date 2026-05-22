import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../lib/theme";
import { AppIcon } from "./AppIcon";

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
    <View style={[styles.shell, { backgroundColor: Colors.bg }]}>
      <View style={[styles.container, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: Colors.primaryAlpha12 }]}
          onPress={onPhoto}
          disabled={disabled}
          accessibilityLabel="拍照"
          accessibilityRole="button"
        >
          <AppIcon name="camera-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>

        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: focused ? Colors.surface : Colors.inputBg,
              borderColor: focused ? Colors.primaryLight : "transparent",
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: Colors.textPrimary }]}
            value={text}
            onChangeText={setText}
            placeholder="问问路线、天气，或让它讲讲附近..."
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

        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: canSend ? Colors.primary : Colors.border }]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.75}
          accessibilityLabel="发送消息"
          accessibilityRole="button"
        >
          {disabled ? <ActivityIndicator size="small" color="#fff" /> : <AppIcon name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.xl,
    ...Shadows.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.full,
  },
  inputWrap: {
    flex: 1,
    minHeight: 40,
    maxHeight: 118,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.sm,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 1,
    fontSize: FontSize.md,
    maxHeight: 108,
    textAlignVertical: "top",
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.full,
  },
});
