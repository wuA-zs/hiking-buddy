import type { AgentTool, AgentToolResult } from "../agent/types";
import { getCurrentPosition } from "../services/location";

export const getTrailInfoTool: AgentTool = {
  name: "get_trail_info",
  label: "获取步道信息",
  description: "获取用户附近的步道路线信息，包括距离、难度和预计时间。当用户问路线、需要导航时调用。",
  parameters: {
    type: "object",
    properties: {
      trail_id: {
        type: "string",
        description: "步道 ID（如果有）",
      },
    },
    required: [],
  },
  execute: async (): Promise<AgentToolResult> => {
    const pos = await getCurrentPosition();

    // TODO: 接入真实的步道数据库 API
    // 目前返回 mock 数据，后续可对接高德步道 API 或自建数据库
    const mockTrails = [
      {
        name: "附近步道",
        length: "未知",
        duration: "约 1-2 小时",
        difficulty: "未知",
        description: `当前位置附近 ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)} 的步道信息暂未接入。建议查看当地景区导览图或使用专业徒步 App。`,
      },
    ];

    const text = mockTrails
      .map(
        (t) =>
          `**${t.name}** — 全程${t.length} — 预计${t.duration} — 难度${t.difficulty}\n  ${t.description}`,
      )
      .join("\n\n");

    return {
      content: [{ type: "text", text }],
      details: mockTrails,
    };
  },
};
