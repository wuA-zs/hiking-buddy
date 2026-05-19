import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Agent } from "../src/agent/agent";
import { loadSkills } from "../src/agent/skills";
import { skillStore } from "../src/agent/skill-store";
import { createHikingTools } from "../src/tools/index";
import type { Skill } from "../src/agent/types";
import { getApiKey, getBaseUrl, getModel } from "../src/lib/config";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";
import { takePhoto } from "../src/services/camera";
import { speak, stopSpeaking } from "../src/services/tts";
import { getCurrentPosition } from "../src/services/location";
import { reverseGeocode } from "../src/services/maps";
import { generateId } from "../src/agent/types";
import type { AgentEvent, AgentMessage, AssistantMessage, UserMessage } from "../src/agent/types";
import type { POI } from "../src/services/maps";

import { hikingGuide, photoExplainer, locationNarrator, safetyAdvisor, trailNavigator, amapLbs } from "../src/skills/index";

import { ChatBubble } from "../src/components/ChatBubble";
import { ChatInput } from "../src/components/ChatInput";
import { StreamingText } from "../src/components/StreamingText";
import { MapViewWidget } from "../src/components/MapViewWidget";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

const SYSTEM_PROMPT = `你是一个手机徒步搭子应用的核心 AI 向导"小Pi"。

你陪伴用户徒步旅行，像一位知识渊博且热情的朋友。
你可以通过工具获取用户的位置、搜索附近景点、查询天气。
用户可以拍照发给你，你会识别并讲解照片中的内容。

重要规则：
- 用中文回复，除非用户说其他语言
- 回复简洁（3-5 句话），用户可以追问
- 不确定的事情直接说不知道，不要编造
- 关心用户安全，遇到恶劣天气或危险地形主动提醒`;

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: Colors, isDark } = useTheme();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<AssistantMessage | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const agentRef = useRef<Agent | null>(null);
  const ttsRef = useRef(ttsEnabled);
  const mountedRef = useRef(true);
  ttsRef.current = ttsEnabled;

  useEffect(() => {
    mountedRef.current = true;
    initAgent();
    return () => {
      mountedRef.current = false;
      agentRef.current?.abort();
    };
  }, []);

  async function initAgent() {
    try {
      setAgentReady(false);
      setAgentError(null);

      const apiKey = await getApiKey();
      if (!apiKey) {
        if (!mountedRef.current) return;
        setAgentError("请先在设置中配置 API Key");
        Alert.alert("需要 API Key", "请先在设置中配置 API Key", [
          { text: "去设置", onPress: () => router.push("/settings") },
        ]);
        return;
      }

      const baseURL = (await getBaseUrl()) || "https://api.openai.com/v1";
      const model = await getModel();
      // Load bundled skills
      const bundledSkills = loadSkills({
        "hiking-guide": hikingGuide,
        "photo-explainer": photoExplainer,
        "location-narrator": locationNarrator,
        "safety-advisor": safetyAdvisor,
        "trail-navigator": trailNavigator,
        "amap-lbs": amapLbs,
      });

      // Load user skills from storage
      const userSkills = await skillStore.load();

      // Merge: user skills override bundled skills with same name
      const skillMap = new Map<string, Skill>();
      for (const s of bundledSkills) skillMap.set(s.name, s);
      for (const s of userSkills) skillMap.set(s.name, s);
      const allSkills = Array.from(skillMap.values());

      const tools = createHikingTools(() => agentRef.current?.getSkills() ?? allSkills);
      const agent = new Agent({ apiKey, baseURL, model, systemPrompt: SYSTEM_PROMPT, tools, skills: allSkills });

      agent.subscribe((event: AgentEvent) => {
        if (!mountedRef.current) return;

        switch (event.type) {
          case "message_start":
            if (event.message.role === "assistant") {
              setStreamingMessage({ ...event.message } as AssistantMessage);
            }
            break;
          case "message_update":
            setStreamingMessage({ ...event.message } as AssistantMessage);
            break;
          case "message_end":
            if (event.message.role === "assistant") {
              setStreamingMessage(undefined);
              setMessages((prev) => [...prev, event.message]);
              // TTS
              if (ttsRef.current) {
                const text = (event.message as AssistantMessage).content
                  .filter((c): c is { type: "text"; text: string } => c.type === "text")
                  .map((c) => c.text)
                  .join("");
                if (text) speak(text);
              }
            }
            break;
          case "agent_start":
            setIsStreaming(true);
            break;
          case "agent_end":
            setIsStreaming(false);
            break;
        }
      });

      agentRef.current = agent;

      if (!mountedRef.current) return;
      setAgentReady(true);
      setMessages([
        {
          id: generateId(),
          role: "assistant",
          content: [{ type: "text", text: "你好！我是小Pi 🥾，你的徒步搭子。今天想去哪走走？你可以拍照让我认认花草，也可以让我讲讲附近的故事。" }],
          stopReason: "stop",
          model: "hiking-buddy",
          usage: { inputTokens: 0, outputTokens: 0 },
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setAgentError(`初始化失败: ${msg}`);
      console.error("[initAgent] failed:", err);
    }
  }

  const handleSend = useCallback(
    async (text: string) => {
      stopSpeaking();

      const userMsg: UserMessage = {
        id: generateId(),
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      if (!agentRef.current) {
        const tip = agentError
          ? agentError
          : "Agent 正在初始化中，请稍等片刻再试。如果持续出现，请在设置中检查 API Key 配置。";
        const errMsg: AssistantMessage = {
          id: generateId(),
          role: "assistant",
          content: [{ type: "text", text: tip }],
          stopReason: "error",
          model: "",
          usage: { inputTokens: 0, outputTokens: 0 },
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
        return;
      }

      try {
        await agentRef.current.prompt(text);
      } catch (err) {
        if (!mountedRef.current) return;
        const errMsg: AssistantMessage = {
          id: generateId(),
          role: "assistant",
          content: [{ type: "text", text: `发送失败: ${err instanceof Error ? err.message : "未知错误"}` }],
          stopReason: "error",
          model: "",
          usage: { inputTokens: 0, outputTokens: 0 },
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    },
    [],
  );

  const handlePhoto = useCallback(async () => {
    stopSpeaking();

    try {
      const photo = await takePhoto();
      if (!photo) return;

      if (!agentRef.current) return;

      const userMsg: UserMessage = {
        id: generateId(),
        role: "user",
        content: [
          { type: "text", text: "帮我看看这是什么" },
          { type: "image", data: photo.base64, mimeType: photo.mimeType },
        ],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      await agentRef.current.prompt("帮我看看这是什么", [
        { data: photo.base64, mimeType: photo.mimeType },
      ]);
    } catch (err) {
      Alert.alert("拍照失败", err instanceof Error ? err.message : "未知错误");
    }
  }, []);

  const handleLocationTap = useCallback(
    async (lat: number, lng: number, address: string) => {
      if (!agentRef.current) return;
      const text = `📍 我在 ${address}`;
      const userMsg: UserMessage = {
        id: generateId(),
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        await agentRef.current.prompt(`用户分享了他的位置：${address}（${lat}, ${lng}）。请根据这个位置给一些讲解或建议。`);
      } catch {
        // silent
      }
    },
    [],
  );

  const handlePOITap = useCallback(
    async (poi: POI) => {
      if (!agentRef.current) return;
      const text = `📍 ${poi.name}（${poi.distance}m）`;
      const userMsg: UserMessage = {
        id: generateId(),
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        await agentRef.current.prompt(`用户在地图上点击了一个兴趣点：${poi.name}，距离 ${poi.distance}m，地址：${poi.address}。请简要介绍这个地方。`);
      } catch {
        // silent
      }
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: AgentMessage }) => {
      return <ChatBubble message={item} />;
    },
    [],
  );

  // FlatList data is committed messages; streaming shown via ListFooterComponent
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

        {/* Gradient Header */}
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}
        >
          <Text style={styles.headerTitle}>徒步搭子</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setTtsEnabled(!ttsEnabled)}
              style={styles.headerBtn}
              accessibilityLabel={ttsEnabled ? "关闭语音播报" : "开启语音播报"}
              accessibilityRole="button"
            >
              <Ionicons name={ttsEnabled ? "volume-high" : "volume-mute"} size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              style={styles.headerBtn}
              accessibilityLabel="设置"
              accessibilityRole="button"
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Map Widget */}
        <MapViewWidget onLocationTap={handleLocationTap} onPOITap={handlePOITap} />

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListFooterComponent={streamFooter}
          ListFooterComponentStyle={{}}
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

        {/* Input */}
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
    paddingVertical: Spacing.md + 2,
    ...Shadows.md,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
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
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
});
