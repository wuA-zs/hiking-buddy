/**
 * Agent class — simplified from pi-agent-core
 *
 * Manages conversation state, streaming events, and tool execution.
 * Uses OpenAI-compatible chat completions API via fetch.
 */

import type {
  AgentConfig,
  AgentEvent,
  AgentMessage,
  AgentTool,
  AgentToolResult,
  AssistantMessage,
  Skill,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "./types";
import { formatSkillsForSystemPrompt } from "./skills";

type EventListener = (event: AgentEvent) => void;

// ── SSE Stream Chunk ──────────────────────────────────────────

interface ChatChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class Agent {
  private messages: AgentMessage[] = [];
  private tools: Map<string, AgentTool> = new Map();
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
    this.skills = config.skills;
    this.systemPrompt = this.buildSystemPrompt(config.systemPrompt, config.skills);
    for (const tool of config.tools) {
      this.tools.set(tool.name, tool);
    }
  }

  // ── Public API ──────────────────────────────────────────────

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async prompt(text: string, images?: Array<{ data: string; mimeType: string }>): Promise<void> {
    if (this.isStreaming) throw new Error("Agent is already processing");

    const userMessage: UserMessage = {
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

  // ── Core Loop ───────────────────────────────────────────────

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

  private async streamAssistant(): Promise<AssistantMessage> {
    const url = `${this.baseURL}/chat/completions`;
    const body = this.buildRequestBody();

    let message: AssistantMessage = {
      role: "assistant",
      content: [],
      stopReason: "stop",
      model: this.model,
      usage: { inputTokens: 0, outputTokens: 0 },
      timestamp: Date.now(),
    };

    await this.emit({ type: "message_start", message });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        message.stopReason = "error";
        message.content = [{ type: "text", text: `API 错误 (${response.status}): ${errText}` }];
        message.errorMessage = errText;
        return message;
      }

      // Parse SSE stream
      const reader = response.body!.getReader();
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
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: `Unknown tool: ${toolCall.name}` }],
        isError: true,
        timestamp: Date.now(),
      };
    }

    await this.emit({
      type: "tool_execution_start",
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      args: toolCall.arguments,
    });

    let result: AgentToolResult;
    let isError = false;

    try {
      result = await tool.execute(
        toolCall.id,
        toolCall.arguments,
        this.abortController?.signal,
        (partial) => {
          this.emit({
            type: "tool_execution_update",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            partialResult: partial,
          });
        },
      );
    } catch (error) {
      result = {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      };
      isError = true;
    }

    await this.emit({
      type: "tool_execution_end",
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      result,
      isError,
    });

    return {
      role: "toolResult",
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      content: result.content,
      isError,
      timestamp: Date.now(),
    };
  }

  // ── OpenAI Request Body ─────────────────────────────────────

  private buildRequestBody(): Record<string, unknown> {
    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: this.systemPrompt },
    ];

    for (const msg of this.messages) {
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
        const content: string | null = msg.content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("") || null;

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

  // ── Helpers ─────────────────────────────────────────────────

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
    const date = new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return `${basePrompt}\n\n${skillSection}\n\n当前日期: ${date}`;
  }
}
