type JsonRecord = Record<string, unknown>;

export function normalizeAGenUIPayloadForNative(payload: string): string {
  try {
    const parsed = JSON.parse(payload);
    const normalized = normalizeMessageList(Array.isArray(parsed) ? parsed : [parsed]);
    return JSON.stringify(Array.isArray(parsed) ? normalized : normalized[0]);
  } catch {
    return payload;
  }
}

function normalizeMessageList(messages: unknown[]): unknown[] {
  let currentSurfaceId: string | undefined;

  return messages.map((message) => {
    if (!isRecord(message)) return message;

    const next: JsonRecord = { ...message };
    const createSurface = next.createSurface;
    if (isRecord(createSurface) && typeof createSurface.surfaceId === "string") {
      currentSurfaceId = createSurface.surfaceId;
    }

    for (const key of ["updateComponents", "updateDataModel", "deleteSurface"] as const) {
      const operation = next[key];
      if (!isRecord(operation)) continue;

      const normalizedOperation: JsonRecord = { ...operation };
      if (!normalizedOperation.surfaceId && currentSurfaceId) {
        normalizedOperation.surfaceId = currentSurfaceId;
      }
      if (key === "updateComponents") {
        delete normalizedOperation.rootComponentIds;
      }
      next[key] = normalizedOperation;
    }

    return next;
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
