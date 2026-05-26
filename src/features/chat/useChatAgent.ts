import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import type { AGenUIAction, AGenUIActionEvent } from "expo-agenui";
import { Agent } from "../../agent/agent";
import { generateId } from "../../agent/types";
import type { AgentEvent, AgentMessage, AssistantMessage, Skill, UserMessage } from "../../agent/types";
import { loadSkills } from "../../agent/skills";
import { skillStore } from "../../agent/skill-store";
import { bundledSkillDocs, bundledSkills } from "../../skills";
import { createHikingTools } from "../../tools";
import { getApiKey, getBaseUrl, getDisabledSkills, getModel, getPersona } from "../../lib/config";
import { takePhoto } from "../../services/camera";
import type { POI } from "../../services/maps";
import { speak, stopSpeaking } from "../../services/tts";
import { buildSystemPrompt } from "./buildSystemPrompt";

export function useChatAgent() {
  const router = useRouter();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<AssistantMessage | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);

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

  const toggleTts = useCallback(() => {
    setTtsEnabled((enabled) => !enabled);
  }, []);

  async function initAgent() {
    try {
      setAgentReady(false);
      setAgentError(null);

      const apiKey = await getApiKey();
      if (!apiKey) {
        if (!mountedRef.current) return;
        const message = "请先在设置中配置 API Key";
        setAgentError(message);
        Alert.alert("需要 API Key", message, [
          { text: "去设置", onPress: () => router.push("/settings") },
        ]);
        return;
      }

      const baseURL = (await getBaseUrl()) || "https://api.openai.com/v1";
      const model = await getModel();
      const persona = await getPersona();
      const disabledNames = await getDisabledSkills();
      const loadedSkills = loadSkills(bundledSkills, "bundled", bundledSkillDocs).filter(
        (skill: Skill) => !disabledNames.includes(skill.name),
      );
      const userSkills = await skillStore.load();

      const skillMap = new Map<string, Skill>();
      for (const skill of loadedSkills) skillMap.set(skill.name, skill);
      for (const skill of userSkills) {
        if (!disabledNames.includes(skill.name)) skillMap.set(skill.name, skill);
      }
      const allSkills = Array.from(skillMap.values());

      const tools = createHikingTools(() => agentRef.current?.getSkills() ?? allSkills);
      const agent = new Agent({
        apiKey,
        baseURL,
        model,
        systemPrompt: buildSystemPrompt(persona),
        tools,
        skills: allSkills,
      });

      agent.subscribe(handleAgentEvent);
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
      const message = err instanceof Error ? err.message : String(err);
      setAgentError(`初始化失败：${message}`);
      console.error("[initAgent] failed:", err);
    }
  }

  function handleAgentEvent(event: AgentEvent) {
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
          speakAssistantMessage(event.message);
        }
        break;
      case "agent_start":
        setIsStreaming(true);
        break;
      case "agent_end":
        setIsStreaming(false);
        break;
    }
  }

  function speakAssistantMessage(message: AssistantMessage) {
    if (!ttsRef.current) return;
    const text = message.content
      .filter((content): content is { type: "text"; text: string } => content.type === "text")
      .map((content) => content.text)
      .join("");
    if (text) speak(text);
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
        appendAssistantError(agentError ?? "走走搭子正在初始化，请稍后再试。如持续出现，请检查设置中的 API Key。");
        return;
      }

      try {
        await agentRef.current.prompt(text);
      } catch (err) {
        appendAssistantError(`发送失败：${err instanceof Error ? err.message : "未知错误"}`);
      }
    },
    [agentError],
  );

  const handlePhoto = useCallback(async () => {
    stopSpeaking();

    try {
      const photo = await takePhoto();
      if (!photo || !agentRef.current) return;

      const prompt = "帮我看看这是什么？";
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

  const handleLocationTap = useCallback(async (lat: number, lng: number, address: string) => {
    if (!agentRef.current) return;
    const text = `我在 ${address}`;
    setMessages((prev) => [...prev, {
      id: generateId(),
      role: "user",
      content: [{ type: "text", text }],
      timestamp: Date.now(),
    }]);

    try {
      await agentRef.current.prompt(
        `用户分享了他的位置：${address}（${lat}, ${lng}）。请根据这个位置给一些适合日常散步的附近去处、轻松路线或安全建议。`,
      );
    } catch {
      // Keep the UI calm if a location prompt fails.
    }
  }, []);

  const handlePOITap = useCallback(async (poi: POI) => {
    if (!agentRef.current) return;
    const text = `${poi.name}（${poi.distance}m）`;
    setMessages((prev) => [...prev, {
      id: generateId(),
      role: "user",
      content: [{ type: "text", text }],
      timestamp: Date.now(),
    }]);

    try {
      await agentRef.current.prompt(
        `用户在地图上点击了一个兴趣点：${poi.name}，距离 ${poi.distance}m，地址：${poi.address}。请简要介绍这个地方，并给出是否适合散步顺路去看看的建议。`,
      );
    } catch {
      // Keep the UI calm if a POI prompt fails.
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
    const actionText = action ? JSON.stringify(action) : event.rawEvent;
    try {
      await agentRef.current.prompt(
        `用户点击了 AGenUI 卡片中的交互项。surfaceId=${event.surfaceId ?? ""} componentId=${event.componentId ?? ""} action=${actionText}。请根据这个交互继续执行，必要时调用工具。`,
      );
    } catch {
      // Keep card interaction quiet if the agent is busy.
    }
  }, []);

  function appendAssistantError(text: string) {
    const errMsg: AssistantMessage = {
      id: generateId(),
      role: "assistant",
      content: [{ type: "text", text }],
      stopReason: "error",
      model: "",
      usage: { inputTokens: 0, outputTokens: 0 },
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, errMsg]);
  }

  return {
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
    handleAGenUIAction,
  };
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
