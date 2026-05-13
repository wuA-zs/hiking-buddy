import type { AgentTool, AgentToolResult } from "../agent/types";
import { getCurrentPosition } from "../services/location";
import { searchNearby } from "../services/maps";

export const searchNearbyTool: AgentTool = {
  name: "search_nearby",
  label: "搜索附近兴趣点",
  description:
    "搜索用户附近的景点、餐厅、厕所、步道等兴趣点。当用户问'附近有什么'或需要了解周边环境时调用。",
  parameters: {
    type: "object",
    properties: {
      keyword: {
        type: "string",
        description: "搜索关键词，如'瀑布''厕所''餐厅'",
      },
      radius: {
        type: "number",
        description: "搜索半径(米)，默认1000",
      },
    },
    required: [],
  },
  execute: async (_id, params): Promise<AgentToolResult> => {
    const pos = await getCurrentPosition();
    const radius = (params.radius as number) ?? 1000;
    const keyword = params.keyword as string | undefined;
    const pois = await searchNearby(pos.latitude, pos.longitude, keyword, radius);

    if (pois.length === 0) {
      return {
        content: [{ type: "text", text: keyword ? `附近没有找到"${keyword}"相关的地点。` : "附近没有找到兴趣点。" }],
      };
    }

    const text = pois
      .slice(0, 10)
      .map((poi, i) => `${i + 1}. **${poi.name}** — ${poi.distance}m (${poi.direction}) — ${poi.type}`)
      .join("\n");

    return {
      content: [{ type: "text", text }],
      details: pois,
    };
  },
};
