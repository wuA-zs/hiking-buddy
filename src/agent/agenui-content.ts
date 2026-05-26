import type { AGenUIContent, AssistantMessage, TextContent } from "./types";
import { generateId } from "./types";

type AssistantContent = AssistantMessage["content"][number];

const AGENUI_FENCE_RE = /```agenui(?:\s+json)?\s*\n?([\s\S]*?)```/gi;
const JSON_FENCE_RE = /```json\s*\n?([\s\S]*?)```/gi;

export function normalizeAGenUIContent(message: AssistantMessage): void {
  const normalized: AssistantContent[] = [];
  let changed = false;

  for (const content of message.content) {
    if (content.type !== "text") {
      normalized.push(content);
      continue;
    }

    const pieces = splitAGenUIBlocks(content.text);
    if (pieces.length === 1 && pieces[0].type === "text" && pieces[0].text === content.text) {
      normalized.push(content);
      continue;
    }

    changed = true;
    normalized.push(...pieces);
  }

  if (changed) {
    message.content = normalized;
  }
}

function splitAGenUIBlocks(text: string): (TextContent | AGenUIContent)[] {
  const wholePayload = extractAGenUIPayload(text);
  if (wholePayload) {
    return [{ type: "agenui", id: generateId(), payload: wholePayload }];
  }

  const agenuiPieces = splitFencedAGenUIBlocks(text, AGENUI_FENCE_RE, true);
  if (agenuiPieces) return agenuiPieces;

  return splitFencedAGenUIBlocks(text, JSON_FENCE_RE, false) ?? [{ type: "text", text }];
}

function splitFencedAGenUIBlocks(
  text: string,
  pattern: RegExp,
  trustFenceLanguage: boolean,
): (TextContent | AGenUIContent)[] | null {
  pattern.lastIndex = 0;
  const pieces: (TextContent | AGenUIContent)[] = [];
  let lastIndex = 0;
  let changed = false;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const rawPayload = match[1]?.trim() ?? "";
    const payload = trustFenceLanguage ? normalizeAGenUIPayload(rawPayload) : extractAGenUIPayload(rawPayload);
    if (!payload) continue;

    if (match.index > lastIndex) {
      pieces.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    pieces.push({ type: "agenui", id: generateId(), payload });
    lastIndex = match.index + match[0].length;
    changed = true;
  }

  if (!changed) return null;
  if (lastIndex < text.length) {
    pieces.push({ type: "text", text: text.slice(lastIndex) });
  }
  return pieces.filter((piece) => piece.type !== "text" || piece.text.length > 0);
}

function extractAGenUIPayload(text: string): string | null {
  try {
    const trimmed = text.trim();
    const parsed = JSON.parse(trimmed);
    if (isAGenUIWrapper(parsed)) {
      return normalizeAGenUIPayload(trimmed);
    }
    return looksLikeAGenUI(parsed) ? trimmed : null;
  } catch {
    return null;
  }
}

function normalizeAGenUIPayload(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload);
    if (isAGenUIWrapper(parsed)) {
      const innerPayload = parsed.payload;
      const normalizedPayload = typeof innerPayload === "string" ? innerPayload : JSON.stringify(innerPayload);
      return extractAGenUIPayload(normalizedPayload);
    }
    return looksLikeAGenUI(parsed) ? payload : null;
  } catch {
    return null;
  }
}

function looksLikeAGenUI(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((item) => looksLikeAGenUI(item));
  }
  if (!isRecord(value)) return false;

  return "createSurface" in value || "updateComponents" in value || "updateDataModel" in value || "deleteSurface" in value;
}

function isAGenUIWrapper(value: unknown): value is { type: "agenui"; payload: unknown } {
  return isRecord(value) && value.type === "agenui" && "payload" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
