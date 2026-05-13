import type { AgentTool, AgentToolResult, TextContent } from "../agent/types";
import { getCurrentPosition, requestPermission } from "../services/location";
import { reverseGeocode } from "../services/maps";

export const getLocationTool: AgentTool = {
  name: "get_location",
  label: "获取当前位置",
  description: "获取用户当前的 GPS 坐标、地址和海拔。当你需要知道用户在哪里时调用此工具。",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (): Promise<AgentToolResult> => {
    const granted = await requestPermission();
    if (!granted) {
      return {
        content: [{ type: "text", text: "用户未授予定位权限，无法获取位置。" }],
      };
    }

    const pos = await getCurrentPosition();
    const addr = await reverseGeocode(pos.latitude, pos.longitude);

    const lines = [
      `地址: ${addr.formatted}`,
      `坐标: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`,
      `海拔: ${pos.altitude?.toFixed(0) ?? "未知"} 米`,
      `精度: ${pos.accuracy?.toFixed(0) ?? "未知"} 米`,
    ];

    if (pos.speed !== null && pos.speed > 0) {
      lines.push(`移动速度: ${(pos.speed * 3.6).toFixed(1)} km/h`);
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      details: { ...pos, address: addr },
    };
  },
};
