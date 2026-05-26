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
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Agent } from "../src/agent/agent";
import { loadSkills } from "../src/agent/skills";
import { skillStore } from "../src/agent/skill-store";
import { createHikingTools } from "../src/tools/index";
import type { Skill } from "../src/agent/types";
import { getApiKey, getBaseUrl, getModel, getPersona, getDisabledSkills } from "../src/lib/config";
import type { AgentPersona } from "../src/lib/config";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";
import { takePhoto } from "../src/services/camera";
import { speak, stopSpeaking } from "../src/services/tts";
import { generateId } from "../src/agent/types";
import type { AgentEvent, AgentMessage, AssistantMessage, UserMessage } from "../src/agent/types";
import type { AGenUIActionEvent, AGenUIAction } from "expo-agenui";
import type { POI } from "../src/services/maps";
import { bundledSkills, bundledSkillDocs } from "../src/skills/index";
import { ChatBubble } from "../src/components/ChatBubble";
import { ChatInput } from "../src/components/ChatInput";
import { StreamingText } from "../src/components/StreamingText";
import { MapViewWidget } from "../src/components/MapViewWidget";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { AppIcon } from "../src/components/AppIcon";

function buildSystemPrompt(persona: AgentPersona): string {
  return `你是手机散步陪伴应用「走走搭子」里的 AI 向导「${persona.name}」。
你陪伴用户日常出门走走，比如下班散步、饭后遛弯、周末在附近逛逛。你像一位熟悉城市和生活细节的朋友，可以通过工具获取用户位置、搜索附近地点、查询天气、规划轻松路线。用户也可以拍照发给你，你需要识别并讲解照片中的内容。
你的性格：${persona.personality}。称呼用户为「${persona.userAddress}」。
重要规则：
- 使用中文回复，除非用户要求其他语言
- 回复简洁自然，优先给出可执行建议
- 不确定的事情直接说明，不要编造
- 语气日常、轻松，不要把普通散步说成远足或登山
- 关心用户安全，遇到恶劣天气、夜间出行、偏僻路线或交通风险要主动提醒
- 你可以帮用户管理文件和笔记。使用 list_files、read_file、create_file、update_file、delete_file 工具来操作文件系统，创建路径用 / 开头如 /notes/todo.txt`;
}

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
      const persona = await getPersona();
      const disabledNames = await getDisabledSkills();
      const loadedSkills = loadSkills(bundledSkills, "bundled", bundledSkillDocs).filter((s: Skill) => !disabledNames.includes(s.name));
      const userSkills = await skillStore.load();

      const skillMap = new Map<string, Skill>();
      for (const s of loadedSkills) skillMap.set(s.name, s);
      for (const s of userSkills) {
        if (!disabledNames.includes(s.name)) skillMap.set(s.name, s);
      }
      const allSkills = Array.from(skillMap.values());

      const systemPrompt = buildSystemPrompt(persona);
      const tools = createHikingTools(() => agentRef.current?.getSkills() ?? allSkills);
      const agent = new Agent({ apiKey, baseURL, model, systemPrompt, tools, skills: allSkills });

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
          content: [
            {
              type: "text",
              text: `你好，我是 ${persona.name}。下班、饭后或周末想出去走走时，都可以叫我。我可以帮你看看附近、查天气，也可以拍照让我讲讲路上看到的东西。`,
            },
          ],
          stopReason: "stop",
          model: "hiking-buddy",
          usage: { inputTokens: 0, outputTokens: 0 },
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setAgentError(`初始化失败：${msg}`);
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
      const tip = agentError ?? "走走搭子正在初始化，请稍等片刻再试。如果持续出现，请在设置中检查 API Key。";
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
          content: [{ type: "text", text: `发送失败：${err instanceof Error ? err.message : "未知错误"}` }],
          stopReason: "error",
          model: "",
          usage: { inputTokens: 0, outputTokens: 0 },
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    },
    [agentError],
  );

  const handlePhoto = useCallback(async () => {
    stopSpeaking();

    try {
      const photo = await takePhoto();
      if (!photo || !agentRef.current) return;

      const prompt = "帮我看看这是什么";
      const userMsg: UserMessage = {
        id: generateId(),
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", data: photo.base64, mimeType: photo.mimeType },
        ],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      await agentRef.current.prompt(prompt, [{ data: photo.base64, mimeType: photo.mimeType }]);
    } catch (err) {
      Alert.alert("拍照失败", err instanceof Error ? err.message : "未知错误");
    }
  }, []);

  const handleLocationTap = useCallback(
    async (lat: number, lng: number, address: string) => {
      if (!agentRef.current) return;
      const text = `我在 ${address}`;
      const userMsg: UserMessage = {
        id: generateId(),
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        await agentRef.current.prompt(`用户分享了他的位置：${address}（${lat}, ${lng}）。请根据这个位置给一些适合日常散步的附近去处、轻松路线或安全建议。`);
      } catch {
        // keep the UI calm if a location prompt fails
      }
    },
    [],
  );

  const handlePOITap = useCallback(async (poi: POI) => {
    if (!agentRef.current) return;
    const text = `${poi.name}（${poi.distance}m）`;
    const userMsg: UserMessage = {
      id: generateId(),
      role: "user",
      content: [{ type: "text", text }],
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      await agentRef.current.prompt(`用户在地图上点击了一个兴趣点：${poi.name}，距离 ${poi.distance}m，地址：${poi.address}。请简要介绍这个地方，并给出是否适合散步顺路去看看的建议。`);
    } catch {
      // keep the UI calm if a POI prompt fails
    }
  }, []);

  const handleAGenUIAction = useCallback(async (event: AGenUIActionEvent) => {
    const action = event.action ?? parseAGenUIAction(event.rawEvent);

    const openUrl = action?.functionCall?.call === "openUrl"
      ? action.functionCall.args?.url
      : undefined;
    if (typeof openUrl === "string") {
      await Linking.openURL(openUrl);
      return;
    }

    if (!agentRef.current) return;
    const actionText = action
      ? JSON.stringify(action)
      : event.rawEvent;
    try {
      await agentRef.current.prompt(
        `用户点击了 AGenUI 卡片中的交互项。surfaceId=${event.surfaceId ?? ""} componentId=${event.componentId ?? ""} action=${actionText}。请根据这个交互继续执行，必要时调用工具。`,
      );
    } catch {
      // Keep the card interaction quiet if the agent is busy.
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: AgentMessage }) => <ChatBubble message={item} onAGenUIAction={handleAGenUIAction} />,
    [handleAGenUIAction],
  );

  const streamFooter = useCallback(() => {
    if (!streamingMessage) return null;
    return <StreamingText message={streamingMessage} onAGenUIAction={handleAGenUIAction} />;
  }, [handleAGenUIAction, streamingMessage]);

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
              <Text style={{ fontSize: 14 }}>📁</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTtsEnabled(!ttsEnabled)}
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

function parseAGenUIAction(rawEvent: string): AGenUIAction | undefined {
  try {
    const parsed = JSON.parse(rawEvent);
    if (parsed.action && typeof parsed.action === "object") {
      return parsed.action as AGenUIAction;
    }
    if (parsed.functionCall || parsed.event) {
      return parsed as AGenUIAction;
    }
  } catch {
    return undefined;
  }
  return undefined;
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
