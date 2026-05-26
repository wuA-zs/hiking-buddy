import type { AssistantMessage } from "./types";

export function parseNonStreamingResponse(text: string, message: AssistantMessage): void {
  try {
    const json = JSON.parse(text);
    const content = json.choices?.[0]?.message?.content;
    if (content) {
      message.content = [{ type: "text", text: content }];
    }

    const finishReason = json.choices?.[0]?.finish_reason;
    if (finishReason === "tool_calls") {
      message.stopReason = "toolUse";
    } else if (finishReason === "length") {
      message.stopReason = "length";
    }

    const toolCalls = json.choices?.[0]?.message?.tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const toolCall of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function?.arguments || "{}");
        } catch {}
        message.content.push({
          type: "toolCall",
          id: toolCall.id || "",
          name: toolCall.function?.name || "",
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
  } catch {
    message.stopReason = "error";
    message.content = [{ type: "text", text: `解析响应失败: ${text.slice(0, 200)}` }];
  }
}
