/**
 * Agent core types — simplified from pi-agent-core
 * Follows the same architecture: AgentMessage, AgentTool, AgentEvent
 */

// ============================================================================
// Message Types
// ============================================================================

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string; // base64
  mimeType: string;
}

export interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface UserMessage {
  id: string;
  role: "user";
  content: (TextContent | ImageContent)[];
  timestamp: number;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  content: (TextContent | ToolCall)[];
  stopReason: "stop" | "toolUse" | "error" | "aborted" | "length";
  errorMessage?: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  timestamp: number;
}

export interface ToolResultMessage {
  id: string;
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: TextContent[];
  isError: boolean;
  timestamp: number;
}

export type AgentMessage = UserMessage | AssistantMessage | ToolResultMessage;

/** Generate a unique message ID (timestamp + random). */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface AgentToolResult {
  content: TextContent[];
  details?: unknown;
  terminate?: boolean;
}

export type AgentToolUpdateCallback = (partial: AgentToolResult) => void;

export interface AgentTool {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback,
  ) => Promise<AgentToolResult>;
}

// ============================================================================
// Event Types
// ============================================================================

export type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: AssistantMessage; toolResults: ToolResultMessage[] }
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AssistantMessage }
  | { type: "message_end"; message: AgentMessage }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool_execution_update"; toolCallId: string; toolName: string; partialResult: unknown }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: unknown; isError: boolean };

// ============================================================================
// Skill Types
// ============================================================================

export interface Skill {
  name: string;
  description: string;
  content: string;
  source: "bundled" | "user";
  disableModelInvocation?: boolean;
}

// ============================================================================
// Agent Config
// ============================================================================

export interface AgentConfig {
  apiKey: string;
  baseURL: string;
  model?: string;
  systemPrompt: string;
  tools: AgentTool[];
  skills: Skill[];
  maxTokens?: number;
}
