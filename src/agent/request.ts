import type { AgentMessage, AgentTool } from "./types";

const MAX_HISTORY_TURNS = 20;

interface BuildChatRequestOptions {
  systemPrompt: string;
  messages: AgentMessage[];
  tools: Iterable<AgentTool>;
  model: string;
  maxTokens: number;
}

export function buildChatCompletionRequest({
  systemPrompt,
  messages: history,
  tools,
  model,
  maxTokens,
}: BuildChatRequestOptions): Record<string, unknown> {
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
  ];

  const recent = history.slice(-MAX_HISTORY_TURNS * 2);

  for (const msg of recent) {
    if (msg.role === "user") {
      const hasImage = msg.content.some((content) => content.type === "image");
      if (hasImage) {
        messages.push({
          role: "user",
          content: msg.content.map((content) => {
            if (content.type === "text") {
              return { type: "text", text: content.text };
            }
            return {
              type: "image_url",
              image_url: { url: `data:${content.mimeType};base64,${content.data}` },
            };
          }),
        });
      } else {
        messages.push({
          role: "user",
          content: msg.content
            .filter((content): content is { type: "text"; text: string } => content.type === "text")
            .map((content) => content.text)
            .join(""),
        });
      }
    } else if (msg.role === "assistant") {
      const textContent = msg.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join("");
      const toolCalls = msg.content
        .filter((content) => content.type === "toolCall")
        .map((content) => ({
          id: content.id,
          type: "function",
          function: { name: content.name, arguments: JSON.stringify(content.arguments) },
        }));

      const entry: Record<string, unknown> = { role: "assistant" };
      if (textContent) entry.content = textContent;
      if (toolCalls.length > 0) entry.tool_calls = toolCalls;
      if (!textContent && toolCalls.length === 0) entry.content = "";
      messages.push(entry);
    } else {
      messages.push({
        role: "tool",
        tool_call_id: msg.toolCallId,
        content: msg.content.map((content) => content.text).join("\n"),
      });
    }
  }

  const toolDefinitions = Array.from(tools).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  return {
    model,
    max_tokens: maxTokens,
    messages,
    ...(toolDefinitions.length > 0 ? { tools: toolDefinitions } : {}),
    stream: true,
  };
}
