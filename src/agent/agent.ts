/**
 * Agent class 鈥?simplified from pi-agent-core
 *
 * Manages conversation state, streaming events, and tool execution.
 * Uses OpenAI-compatible chat completions API via fetch.
 */

import { fetch } from "expo/fetch";
import type {
  AgentConfig,
  AgentEvent,
  AgentMessage,
  AgentTool,
  AssistantMessage,
  Skill,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "./types";
import { generateId } from "./types";
import { formatSkillsForSystemPrompt } from "./skills";
import { formatAGenUIClientCapabilitiesForPrompt } from "../agenui/capabilities";
import { normalizeAGenUIContent } from "./agenui-content";
import type { ChatChunk } from "./openai-types";
import { parseSSEText } from "./sse";
import { runAgentTool } from "./tool-runner";

type EventListener = (event: AgentEvent) => void;

const REQUEST_TIMEOUT_MS = 60_000;
const TOOL_TIMEOUT_MS = 30_000;
const MAX_HISTORY_TURNS = 20; // Keep last N messages (excl. system)

// 鈹€鈹€ SSE Stream Chunk 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export class Agent {
  private messages: AgentMessage[] = [];
  private tools: Map<string, AgentTool> = new Map();
  private basePrompt: string;
  private skills: Skill[];
  private systemPrompt: string;
  private baseURL: string;
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private listeners: Set<EventListener> = new Set();
  private abortController: AbortController | null = null;
  private isStreaming = false;

  constructor(config: AgentConfig) {
    this.baseURL = config.baseURL.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.model = config.model ?? "gpt-4o";
    this.maxTokens = config.maxTokens ?? 4096;
    this.basePrompt = config.systemPrompt;
    this.skills = config.skills;
    this.systemPrompt = this.buildSystemPrompt(this.basePrompt, config.skills);
    for (const tool of config.tools) {
      this.tools.set(tool.name, tool);
    }
  }

  // 鈹€鈹€ Public API 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async prompt(text: string, images?: Array<{ data: string; mimeType: string }>): Promise<void> {
    if (this.isStreaming) throw new Error("Agent is already processing");

    const userMessage: UserMessage = {
      id: generateId(),
      role: "user",
      content: images
        ? [
            { type: "text", text },
            ...images.map((img) => ({ type: "image" as const, data: img.data, mimeType: img.mimeType })),
          ]
        : [{ type: "text", text }],
      timestamp: Date.now(),
    };

    this.messages.push(userMessage);
    await this.run();
  }

  abort(): void {
    this.abortController?.abort();
  }

  getState() {
    return {
      messages: [...this.messages],
      isStreaming: this.isStreaming,
    };
  }

  reset(): void {
    this.messages = [];
    this.abort();
  }

  /** Reload skills and rebuild system prompt. */
  reloadSkills(skills: Skill[]): void {
    this.skills = skills;
    this.systemPrompt = this.buildSystemPrompt(this.basePrompt, skills);
  }

  /** Get current skills list (for load_skill tool). */
  getSkills(): Skill[] {
    return this.skills;
  }

  // 鈹€鈹€ Core Loop 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  private async run(): Promise<void> {
    this.abortController = new AbortController();
    this.isStreaming = true;

    try {
      await this.emit({ type: "agent_start" });

      let continueLoop = true;
      while (continueLoop) {
        await this.emit({ type: "turn_start" });

        const assistantMessage = await this.streamAssistant();
        this.messages.push(assistantMessage);
        await this.emit({ type: "message_end", message: assistantMessage });

        if (assistantMessage.stopReason === "error" || assistantMessage.stopReason === "aborted") {
          await this.emit({ type: "turn_end", message: assistantMessage, toolResults: [] });
          continueLoop = false;
          break;
        }

        const toolCalls = assistantMessage.content.filter((c): c is ToolCall => c.type === "toolCall");
        const toolResults: ToolResultMessage[] = [];

        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            const result = await this.executeTool(toolCall);
            toolResults.push(result);
            this.messages.push(result);
          }
        }

        await this.emit({ type: "turn_end", message: assistantMessage, toolResults });
        continueLoop = toolCalls.length > 0;
      }

      await this.emit({ type: "agent_end", messages: [...this.messages] });
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  private parseNonStreamingResponse(text: string, message: AssistantMessage): void {
    try {
      const json = JSON.parse(text);
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        message.content = [{ type: "text", text: content }];
        normalizeAGenUIContent(message);
      }
      const finishReason = json.choices?.[0]?.finish_reason;
      if (finishReason === "tool_calls") {
        message.stopReason = "toolUse";
      } else if (finishReason === "length") {
        message.stopReason = "length";
      }
      // Tool calls
      const toolCalls = json.choices?.[0]?.message?.tool_calls;
      if (Array.isArray(toolCalls)) {
        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
          message.content.push({
            type: "toolCall",
            id: tc.id || "",
            name: tc.function?.name || "",
            arguments: args,
          });
        }
      }
      if (json.usage) {
        message.usage = {
          inputTokens: json.usage.prompt_tokens ?? 0,
          outputTokens: json.usage.completion_tokens ?? 0,
        };
      }
      normalizeAGenUIContent(message);
    } catch {
      message.stopReason = "error";
      message.content = [{ type: "text", text: `瑙ｆ瀽鍝嶅簲澶辫触: ${text.slice(0, 200)}` }];
    }
  }

  private async streamAssistant(): Promise<AssistantMessage> {
    const url = `${this.baseURL}/chat/completions`;
    const body = this.buildRequestBody();

    let message: AssistantMessage = {
      id: generateId(),
      role: "assistant",
      content: [],
      stopReason: "stop",
      model: this.model,
      usage: { inputTokens: 0, outputTokens: 0 },
      timestamp: Date.now(),
    };

    await this.emit({ type: "message_start", message });

    try {
      // Create a timeout signal that works alongside the abort signal
      const timeoutId = setTimeout(() => this.abortController?.abort(), REQUEST_TIMEOUT_MS);
      const signal = this.abortController?.signal;

      let response: Awaited<ReturnType<typeof fetch>>;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errText = await response.text();
        message.stopReason = "error";
        const userMsg = response.status === 401 || response.status === 403
          ? "API Key 无效或已过期，请在设置中检查配置。"
          : response.status === 429
            ? "请求太频繁，请稍后再试。"
            : response.status >= 500
              ? "服务暂时不可用，请稍后再试。"
              : `请求失败 (${response.status})，请检查设置后重试。`;
        message.content = [{ type: "text", text: userMsg }];
        message.errorMessage = `HTTP ${response.status}: ${errText.slice(0, 200)}`;
        return message;
      }

      // Fallback: if response.body is not a ReadableStream (some Android runtimes),
      // read the full text and handle both SSE and non-streaming formats
      if (!response.body?.getReader) {
        const text = await response.text();
        // If response contains SSE lines, parse them; otherwise treat as plain JSON
        if (text.includes("data: ")) {
          parseSSEText(text, message);
        } else {
          this.parseNonStreamingResponse(text, message);
        }
        await this.emit({ type: "message_update", message });
        return message;
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const toolCallBuffers: Map<number, { id: string; name: string; arguments: string }> = new Map();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          let chunk: ChatChunk;
          try {
            chunk = JSON.parse(data);
          } catch {
            continue;
          }

          const delta = chunk.choices?.[0]?.delta;

          // Text content
          if (delta?.content) {
            const lastBlock = message.content[message.content.length - 1];
            if (lastBlock && lastBlock.type === "text") {
              lastBlock.text += delta.content;
            } else {
              message.content.push({ type: "text", text: delta.content });
            }
            await this.emit({ type: "message_update", message });
          }

          // Tool calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallBuffers.has(idx)) {
                toolCallBuffers.set(idx, {
                  id: tc.id || "",
                  name: tc.function?.name || "",
                  arguments: "",
                });
              }
              const buf = toolCallBuffers.get(idx)!;
              if (tc.id) buf.id = tc.id;
              if (tc.function?.name) buf.name = tc.function.name;
              if (tc.function?.arguments) buf.arguments += tc.function.arguments;
            }
            await this.emit({ type: "message_update", message });
          }

          // Usage
          if (chunk.usage) {
            message.usage = {
              inputTokens: chunk.usage.prompt_tokens ?? 0,
              outputTokens: chunk.usage.completion_tokens ?? 0,
            };
          }

          // Finish reason
          const finishReason = chunk.choices?.[0]?.finish_reason;
          if (finishReason) {
            if (finishReason === "tool_calls") {
              message.stopReason = "toolUse";
            } else if (finishReason === "length") {
              message.stopReason = "length";
            }
          }
        }
      }

      // Finalize tool calls
      normalizeAGenUIContent(message);
      for (const [, buf] of toolCallBuffers) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(buf.arguments || "{}");
        } catch {}
        message.content.push({
          type: "toolCall",
          id: buf.id,
          name: buf.name,
          arguments: args,
        });
      }
    } catch (err) {
      if (this.abortController?.signal.aborted) {
        message.stopReason = "aborted";
      } else {
        message.stopReason = "error";
        message.content = [{ type: "text", text: `请求失败: ${err instanceof Error ? err.message : String(err)}` }];
        message.errorMessage = err instanceof Error ? err.message : String(err);
      }
    }

    return message;
  }

  private async executeTool(toolCall: ToolCall): Promise<ToolResultMessage> {
    const tool = this.tools.get(toolCall.name);
    if (!tool) {
      return {
        id: generateId(),
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: `Unknown tool: ${toolCall.name}` }],
        isError: true,
        timestamp: Date.now(),
      };
    }

    return runAgentTool({
      tool,
      toolCall,
      signal: this.abortController?.signal,
      timeoutMs: TOOL_TIMEOUT_MS,
      emit: (event) => this.emit(event),
    });
  }

  // 鈹€鈹€ OpenAI Request Body 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  private buildRequestBody(): Record<string, unknown> {
    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: this.systemPrompt },
    ];

    // Truncate history to avoid token overflow
    const recent = this.messages.slice(-MAX_HISTORY_TURNS * 2);

    for (const msg of recent) {
      if (msg.role === "user") {
        const hasImage = msg.content.some((c) => c.type === "image");
        if (hasImage) {
          messages.push({
            role: "user",
            content: msg.content.map((c) => {
              if (c.type === "text") return { type: "text", text: c.text };
              return {
                type: "image_url",
                image_url: { url: `data:${c.mimeType};base64,${c.data}` },
              };
            }),
          });
        } else {
          messages.push({
            role: "user",
            content: msg.content.filter((c): c is { type: "text"; text: string } => c.type === "text").map((c) => c.text).join(""),
          });
        }
      } else if (msg.role === "assistant") {
        const textContent = msg.content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("");
        const hasAGenUI = msg.content.some((c) => c.type === "agenui");
        const content: string | null = textContent || (hasAGenUI ? "[AGenUI content rendered]" : null);

        const toolCalls = msg.content
          .filter((c) => c.type === "toolCall")
          .map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.arguments) },
          }));

        const entry: Record<string, unknown> = { role: "assistant" };
        if (content) entry.content = content;
        if (toolCalls.length > 0) entry.tool_calls = toolCalls;
        if (!content && toolCalls.length === 0) entry.content = "";
        messages.push(entry);
      } else {
        // toolResult
        messages.push({
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: msg.content.map((c) => c.text).join("\n"),
        });
      }
    }

    const tools = Array.from(this.tools.values()).map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    return {
      model: this.model,
      max_tokens: this.maxTokens,
      messages,
      ...(tools.length > 0 ? { tools } : {}),
      stream: true,
    };
  }

  // 鈹€鈹€ Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  private async emit(event: AgentEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors
      }
    }
  }

  private buildSystemPrompt(basePrompt: string, skills: Skill[]): string {
    const skillSection = formatSkillsForSystemPrompt(skills);
    const agenUISection = skills.some((skill) => skill.name === "a2ui-generation")
      ? `\n\n${formatAGenUIClientCapabilitiesForPrompt()}`
      : "";
    const date = new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return `${basePrompt}\n\n${skillSection}${agenUISection}\n\n当前日期: ${date}`;
  }
}
