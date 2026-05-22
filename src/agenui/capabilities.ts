import catalog from "../agenui_catalog.json";

export const AGENUI_CATALOG_ID = "urn:a2ui:catalog:agenui_catalog";

export const AGENUI_SUPPORTED_COMPONENTS = Object.keys(
  (catalog as { components?: Record<string, unknown> }).components ?? {},
);

export function formatAGenUIClientCapabilitiesForPrompt(): string {
  return [
    "AGenUI client capabilities:",
    `- catalogId: ${AGENUI_CATALOG_ID}`,
    "- protocol: A2UI v0.9",
    `- supportedComponents: ${AGENUI_SUPPORTED_COMPONENTS.join(", ")}`,
    "- output in chat must be a fenced ```agenui block containing { \"type\": \"agenui\", \"payload\": ... }",
    "- payload may include createSurface/updateComponents/updateDataModel; the app feeds it to the native AGenUI SurfaceManager",
    "- clickable UI must use real Button action.functionCall or action.event",
  ].join("\n");
}
