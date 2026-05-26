import type { AgentEvent, AgentTool, AgentToolResult, ToolCall, ToolResultMessage } from "./types";
import { generateId } from "./types";

type EmitAgentEvent = (event: AgentEvent) => Promise<void> | void;

interface RunAgentToolOptions {
  tool: AgentTool;
  toolCall: ToolCall;
  signal?: AbortSignal;
  timeoutMs: number;
  emit: EmitAgentEvent;
}

export async function runAgentTool({
  tool,
  toolCall,
  signal,
  timeoutMs,
  emit,
}: RunAgentToolOptions): Promise<ToolResultMessage> {
  await emit({
    type: "tool_execution_start",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    args: toolCall.arguments,
  });

  let result: AgentToolResult;
  let isError = false;

  try {
    const toolPromise = tool.execute(toolCall.id, toolCall.arguments, signal, (partial) => {
      emit({
        type: "tool_execution_update",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        partialResult: partial,
      });
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`工具执行超时 (${timeoutMs / 1000}s)`)), timeoutMs),
    );
    result = await Promise.race([toolPromise, timeoutPromise]);
  } catch (error) {
    result = {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    };
    isError = true;
  }

  await emit({
    type: "tool_execution_end",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    result,
    isError,
  });

  return {
    id: generateId(),
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: result.content,
    isError,
    timestamp: Date.now(),
  };
}
