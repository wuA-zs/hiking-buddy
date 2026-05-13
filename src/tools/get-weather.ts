import type { AgentTool, AgentToolResult } from "../agent/types";
import { getCurrentPosition } from "../services/location";
import { getWeather } from "../services/weather";

export const getWeatherTool: AgentTool = {
  name: "get_weather",
  label: "查询天气",
  description: "获取用户当前位置的当前天气状况，包括温度、体感温度、风速、湿度和预报。在评估徒步安全时调用。",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (): Promise<AgentToolResult> => {
    const pos = await getCurrentPosition();
    const weather = await getWeather(pos.latitude, pos.longitude);

    const lines = [
      `${weather.temp}°C (体感 ${weather.feelsLike}°C)`,
      `天气: ${weather.description}`,
      `风速: ${weather.windSpeed} m/s ${weather.windDir}风`,
      `湿度: ${weather.humidity}%`,
      weather.forecast,
    ];

    // Safety warnings
    const warnings: string[] = [];
    if (weather.temp > 35) warnings.push("高温预警：注意防暑降温，多喝水");
    if (weather.temp < 5) warnings.push("低温预警：注意保暖防寒");
    if (weather.windSpeed > 13.8) warnings.push("大风预警：建议停止行进或寻找避风处");
    if (weather.description.includes("雷")) warnings.push("雷暴预警：远离空旷地带和高地");
    if (weather.description.includes("大雨") || weather.description.includes("大阵雨")) {
      warnings.push("强降雨预警：注意溪流水位，考虑下撤");
    }

    if (warnings.length > 0) {
      lines.push("", "⚠️ 安全提醒:", ...warnings.map((w) => `- ${w}`));
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      details: weather,
    };
  },
};
