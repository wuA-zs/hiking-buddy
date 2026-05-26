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
    "- chat renders AGenUI inside the existing assistant bubble; do not add debug labels, JSON/copy controls, oversized blank space, or a heavy standalone card shell unless explicitly requested",
    "- native component shape is strict: every updateComponents.components item must use `component`, top-level official fields, and `styles`",
    "- forbidden in updateComponents.components: `type`, `props`, `style`, lowercase component names, React-style props objects",
    "- forbidden in updateComponents: `rootComponentIds`; the native renderer builds hierarchy only from component-level `children`/`child` references",
    "- component tree must have exactly one root; attach Text/Image/Button descendants through Column/Row/List `children` arrays or Card/Button `child`",
    "- layout components Column, Row, and List must declare `children`; Card and Button must declare a single `child` component id",
    "- example component: { \"id\": \"title\", \"component\": \"Text\", \"text\": { \"path\": \"/data/title\" }, \"styles\": { \"font-size\": \"32px\" } }",
    "- example root layout: { \"id\": \"root\", \"component\": \"Column\", \"children\": [\"title\"], \"styles\": { \"padding\": \"16px 16px 16px 16px\" } }",
    "- clickable UI must use real Button action.functionCall or action.event",
  ].join("\n");
}
