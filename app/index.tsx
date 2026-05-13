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
import { useRouter } from "expo-router";
import { Agent } from "../src/agent/agent";
import { loadSkills } from "../src/agent/skills";
import { createHikingTools } from "../src/tools/index";
import { getApiKey, getBaseUrl, getModel } from "../src/lib/config";
import { Colors, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";
import { takePhoto } from "../src/services/camera";
import { speak, stopSpeaking } from "../src/services/tts";
import { getCurrentPosition } from "../src/services/location";
import { reverseGeocode } from "../src/services/maps";
import type { AgentEvent, AgentMessage, AssistantMessage, UserMessage } from "../src/agent/types";
import type { POI } from "../src/services/maps";

import { hikingGuide, photoExplainer, locationNarrator, safetyAdvisor, trailNavigator, amapLbs } from "../src/skills/index";

import { ChatBubble } from "../src/components/ChatBubble";
import { ChatInput } from "../src/components/ChatInput";
import { StreamingText } from "../src/components/StreamingText";
import { MapViewWidget } from "../src/components/MapViewWidget";

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
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<AssistantMessage | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const agentRef = useRef<Agent | null>(null);
  const ttsRef = useRef(ttsEnabled);
  ttsRef.current = ttsEnabled;

  useEffect(() => {
    initAgent();
  }, []);

  async function initAgent() {
    const apiKey = await getApiKey();
    if (!apiKey) {
      Alert.alert("需要 API Key", "请先在设置中配置 API Key", [
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }

    const baseURL = (await getBaseUrl()) || "https://api.openai.com/v1";
    const model = await getModel();
    const skills = loadSkills({
      "hiking-guide": hikingGuide,
      "photo-explainer": photoExplainer,
      "location-narrator": locationNarrator,
      "safety-advisor": safetyAdvisor,
      "trail-navigator": trailNavigator,
      "amap-lbs": amapLbs,
    });

    const tools = createHikingTools();
    const agent = new Agent({ apiKey, baseURL, model, systemPrompt: SYSTEM_PROMPT, tools, skills });

    agent.subscribe((event: AgentEvent) => {
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

    setMessages([
      {
        role: "assistant",
        content: [{ type: "text", text: "你好！我是小Pi 🥾，你的徒步搭子。今天想去哪走走？你可以拍照让我认认花草，也可以让我讲讲附近的故事。" }],
        stopReason: "stop",
        model: "hiking-buddy",
        usage: { inputTokens: 0, outputTokens: 0 },
        timestamp: Date.now(),
      },
    ]);
  }

  const handleSend = useCallback(
    async (text: string) => {
      stopSpeaking();
      if (!agentRef.current) return;

      // FIX: Show user message in UI immediately
      const userMsg: UserMessage = {
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        await agentRef.current.prompt(text);
      } catch (err) {
        Alert.alert("发送失败", err instanceof Error ? err.message : "未知错误");
      }
    },
    [],
  );

  const handlePhoto = useCallback(async () => {
    stopSpeaking();
    if (!agentRef.current) return;

    try {
      const photo = await takePhoto();
      if (!photo) return;

      await agentRef.current.prompt("帮我看看这是什么", [
        { data: photo.base64, mimeType: photo.mimeType },
      ]);
    } catch (err) {
      Alert.alert("拍照失败", err instanceof Error ? err.message : "未知错误");
    }
  }, []);

  // Map interactions
  const handleLocationTap = useCallback(
    async (lat: number, lng: number, address: string) => {
      if (!agentRef.current) return;
      const text = `📍 我在 ${address}`;
      const userMsg: UserMessage = {
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

  // Build renderable data: messages + streaming at the end
  const renderData = [...messages];
  if (streamingMessage) {
    renderData.push(streamingMessage as any);
  }

  const renderItem = useCallback(
    ({ item, index }: { item: AgentMessage; index: number }) => {
      // Last item might be the streaming message
      if (streamingMessage && index === renderData.length - 1) {
        return <StreamingText message={streamingMessage} />;
      }
      return <ChatBubble message={item} />;
    },
    [streamingMessage, renderData.length],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />

      {/* Gradient Header */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>徒步搭子</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setTtsEnabled(!ttsEnabled)} style={styles.headerBtn}>
            <Ionicons name={ttsEnabled ? "volume-high" : "volume-mute"} size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/settings")} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Map Widget */}
      <MapViewWidget onLocationTap={handleLocationTap} onPOITap={handlePOITap} />

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={renderData}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      />

      {/* Input */}
      <ChatInput onSend={handleSend} onPhoto={handlePhoto} disabled={isStreaming} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    paddingTop: Spacing.xxl + 10,
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
    backgroundColor: Colors.bg,
  },
  messageListContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
});
