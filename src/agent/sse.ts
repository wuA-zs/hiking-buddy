import type { ChatChunk } from "./openai-types";
import type { AssistantMessage } from "./types";

export function parseSSEText(text: string, message: AssistantMessage): void {
  const toolCallBuffers: Map<number, { id: string; name: string; arguments: string }> = new Map();

  for (const line of text.split("\n")) {
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

    if (delta?.content) {
      const lastBlock = message.content[message.content.length - 1];
      if (lastBlock && lastBlock.type === "text") {
        lastBlock.text += delta.content;
      } else {
        message.content.push({ type: "text", text: delta.content });
      }
    }

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
    }

    if (chunk.usage) {
      message.usage = {
        inputTokens: chunk.usage.prompt_tokens ?? 0,
        outputTokens: chunk.usage.completion_tokens ?? 0,
      };
    }

    const finishReason = chunk.choices?.[0]?.finish_reason;
    if (finishReason === "tool_calls") {
      message.stopReason = "toolUse";
    } else if (finishReason === "length") {
      message.stopReason = "length";
    }
  }

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
}
