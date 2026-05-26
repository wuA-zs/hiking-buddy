import assert from "node:assert/strict";
import { normalizeAGenUIPayloadForNative } from "./normalizePayload";

const normalized = JSON.parse(
  normalizeAGenUIPayloadForNative(
    JSON.stringify({
      version: "v0.9",
      createSurface: {
        surfaceId: "chat_card",
        catalogId: "urn:a2ui:catalog:agenui_catalog",
      },
      updateComponents: {
        components: [
          {
            id: "root",
            component: "Column",
            children: ["title"],
          },
          {
            id: "title",
            component: "Text",
            text: "Hello",
          },
        ],
        rootComponentIds: ["root"],
      },
    }),
  ),
);

assert.equal(normalized.updateComponents.surfaceId, "chat_card");
assert.equal("rootComponentIds" in normalized.updateComponents, false);

const listNormalized = JSON.parse(
  normalizeAGenUIPayloadForNative(
    JSON.stringify([
      {
        version: "v0.9",
        createSurface: { surfaceId: "list_card" },
      },
      {
        version: "v0.9",
        updateDataModel: {
          path: "/data",
          value: { title: "Hello" },
        },
      },
    ]),
  ),
);

assert.equal(listNormalized[1].updateDataModel.surfaceId, "list_card");
