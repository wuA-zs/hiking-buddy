import type { AgentTool, AgentToolResult } from "../agent/types";
import { getAmapKey } from "../lib/config";
import { getCurrentPosition } from "../services/location";
import { searchNearby } from "../services/maps";

interface TravelStop {
  name: string;
  lat: number;
  lng: number;
  type: string;
  address: string;
}

export const travelPlannerTool: AgentTool = {
  name: "plan_travel",
  label: "旅行规划",
  description:
    "根据用户当前位置和偏好，智能规划一日游或多日游行程。当用户说'帮我规划行程'、'一日游推荐'、'安排路线'时调用。",
  parameters: {
    type: "object",
    properties: {
      theme: {
        type: "string",
        description: "旅行主题，如'自然风光''历史文化''亲子游''美食之旅'。默认综合推荐。",
      },
      duration_hours: {
        type: "number",
        description: "计划游玩时长（小时），默认4小时。",
      },
      max_distance: {
        type: "number",
        description: "最大活动半径（公里），默认10公里。",
      },
    },
    required: [],
  },
  execute: async (_id, params): Promise<AgentToolResult> => {
    const key = await getAmapKey();
    if (!key) {
      return {
        content: [{ type: "text", text: "未配置高德地图 Key，无法规划行程。请在设置中填写高德 Web服务 API Key。" }],
      };
    }

    const theme = (params.theme as string) ?? "综合";
    const durationHours = (params.duration_hours as number) ?? 4;
    const maxDistance = ((params.max_distance as number) ?? 10) * 1000;

    const pos = await getCurrentPosition();

    // Search for multiple categories to build a diverse itinerary
    const categories: Record<string, string> = {
      自然风光: "风景名胜|公园|山岳|湖泊",
      历史文化: "博物馆|古迹|寺庙|历史建筑",
      亲子游: "主题乐园|动物园|水族馆|儿童乐园",
      美食之旅: "特色美食|小吃街|农家乐",
      综合: "风景名胜|公园|博物馆|古迹|寺庙",
    };

    const keyword = categories[theme] ?? categories["综合"];
    const pois = await searchNearby(pos.latitude, pos.longitude, keyword, maxDistance);

    if (pois.length === 0) {
      return {
        content: [{ type: "text", text: `附近 ${maxDistance / 1000} 公里内没有找到适合"${theme}"主题的景点。试试换个主题或扩大范围？` }],
      };
    }

    // Sort by distance and pick stops that fit within duration
    // Estimate ~1-2 hours per stop, plus travel time
    const stops: TravelStop[] = [];
    let remainingMinutes = durationHours * 60;

    for (const poi of pois) {
      if (stops.length >= 6) break;
      // Estimate visit time: 45-90 min per stop
      const visitMinutes = 60;
      // Estimate travel time: rough based on distance
      const travelMinutes = Math.max(10, Math.round(poi.distance / 200));
      const totalTime = visitMinutes + travelMinutes;

      if (totalTime > remainingMinutes) continue;

      stops.push({
        name: poi.name,
        lat: poi.latitude,
        lng: poi.longitude,
        type: poi.type,
        address: poi.address,
      });
      remainingMinutes -= totalTime;
    }

    if (stops.length === 0) {
      return {
        content: [{ type: "text", text: `在 ${durationHours} 小时内安排不了太多行程。建议增加时间或缩小范围。` }],
      };
    }

    // Format itinerary
    const lines = [
      `📋 **${theme}主题行程**（约 ${durationHours} 小时）`,
      `📍 起点: 当前位置`,
      "",
    ];

    stops.forEach((stop, i) => {
      const emoji = i === 0 ? "🚶" : "➡️";
      lines.push(`${emoji} **第 ${i + 1} 站: ${stop.name}**`);
      lines.push(`   类型: ${stop.type} | 地址: ${stop.address}`);
      lines.push(`   建议停留: 45-60 分钟`);
      lines.push("");
    });

    lines.push(`🏁 返回起点`);
    lines.push("");
    lines.push(`💡 提示: 这是基于附近搜索自动生成的行程建议，你可以告诉小Pi想调整哪一站。`);

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      details: stops,
    };
  },
};
