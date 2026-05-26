import React, { useCallback, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { AgentMessage } from "../src/agent/types";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";
import { ChatBubble } from "../src/components/ChatBubble";
import { ChatInput } from "../src/components/ChatInput";
import { StreamingText } from "../src/components/StreamingText";
import { MapViewWidget } from "../src/components/MapViewWidget";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { AppIcon } from "../src/components/AppIcon";
import { useChatAgent } from "../src/features/chat";

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: Colors, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const {
    messages,
    streamingMessage,
    isStreaming,
    agentReady,
    agentError,
    ttsEnabled,
    toggleTts,
    handleSend,
    handlePhoto,
    handleLocationTap,
    handlePOITap,
  } = useChatAgent();

  const renderItem = useCallback(
    ({ item }: { item: AgentMessage }) => <ChatBubble message={item} />,
    [],
  );

  const streamFooter = useCallback(() => {
    if (!streamingMessage) return null;
    return <StreamingText message={streamingMessage} />;
  }, [streamingMessage]);

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: Colors.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <StatusBar style={isDark ? "light" : "dark"} />

        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: Colors.bg }]}>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.kicker, { color: Colors.textTertiary }]}>Walking Buddy</Text>
            <Text style={[styles.headerTitle, { color: Colors.textPrimary }]}>走走搭子</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push("/files")}
              style={[styles.headerBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              accessibilityLabel="文件管理"
              accessibilityRole="button"
            >
              <AppIcon name="document-text-outline" size={19} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleTts}
              style={[styles.headerBtn, { backgroundColor: ttsEnabled ? Colors.primary : Colors.surface, borderColor: Colors.border }]}
              accessibilityLabel={ttsEnabled ? "关闭语音播报" : "开启语音播报"}
              accessibilityRole="button"
            >
              <AppIcon name={ttsEnabled ? "volume-high" : "volume-mute"} size={19} color={ttsEnabled ? Colors.textOnPrimary : Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/agent-config")}
              style={[styles.headerBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              accessibilityLabel="Agent 配置"
              accessibilityRole="button"
            >
              <AppIcon name="person-circle-outline" size={19} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              style={[styles.headerBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              accessibilityLabel="设置"
              accessibilityRole="button"
            >
              <AppIcon name="settings-outline" size={19} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {!agentReady && (
          <View style={[styles.noticeCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <AppIcon name={agentError ? "alert-circle-outline" : "time-outline"} size={17} color={agentError ? Colors.warning : Colors.primary} />
            <Text style={[styles.noticeText, { color: Colors.textSecondary }]} numberOfLines={2}>
              {agentError ?? "正在连接走走搭子，准备好后就可以提问。"}
            </Text>
          </View>
        )}

        <MapViewWidget onLocationTap={handleLocationTap} onPOITap={handlePOITap} />

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListFooterComponent={streamFooter}
          style={[styles.messageList, { backgroundColor: Colors.bg }]}
          contentContainerStyle={styles.messageListContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          windowSize={10}
          maxToRenderPerBatch={5}
          removeClippedSubviews={true}
          initialNumToRender={15}
        />

        <ChatInput onSend={handleSend} onPhoto={handlePhoto} disabled={isStreaming || !agentReady} />
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
  },
  kicker: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: FontSize.title,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
});
