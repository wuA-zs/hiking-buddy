import type { AgentTool, AgentToolResult } from "../agent/types";
import { getAmapKey } from "../lib/config";
import { getCurrentPosition } from "../services/location";

interface RouteStep {
  instruction: string;
  road?: string;
  distance: number;
  duration: number;
}

interface RouteResult {
  origin: string;
  destination: string;
  distance: number; // meters
  duration: number; // seconds
  steps: RouteStep[];
  polyline?: string;
}

// Amap API response types
interface AmapStep {
  instruction?: string;
  road?: string;
  distance?: string | number;
  duration?: string | number;
}

interface AmapPath {
  distance?: string | number;
  duration?: string | number;
  steps?: AmapStep[];
}

interface AmapRidingStep {
  instruction?: string;
  road?: string;
  distance?: string | number;
  duration?: string | number;
}

interface AmapRidingPath {
  distance?: string | number;
  duration?: string | number;
  steps?: AmapRidingStep[];
}

export async function planRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: "walking" | "driving" | "riding" | "transit",
): Promise<RouteResult[]> {
  const key = await getAmapKey();
  if (!key) {
    throw new Error("未配置高德地图 Key，无法规划路线。请在设置中填写高德 Web服务 API Key。");
  }

  const origin = `${originLng},${originLat}`;
  const destination = `${destLng},${destLat}`;

  const apiMap: Record<string, string> = {
    walking: "https://restapi.amap.com/v3/direction/walking",
    driving: "https://restapi.amap.com/v3/direction/driving",
    riding: "https://restapi.amap.com/v4/direction/bicycling",
    transit: "https://restapi.amap.com/v3/direction/transit/integrated",
  };

  const url = apiMap[mode];
  if (!url) throw new Error(`不支持的出行方式: ${mode}`);

  let queryUrl: string;
  if (mode === "transit") {
    queryUrl = `${url}?key=${key}&origin=${origin}&destination=${destination}&city=全国&strategy=0`;
  } else if (mode === "riding") {
    queryUrl = `${url}?key=${key}&origin=${origin}&destination=${destination}`;
  } else {
    queryUrl = `${url}?key=${key}&origin=${origin}&destination=${destination}`;
  }

  const resp = await fetch(queryUrl);
  const data = await resp.json();

  if (data.status !== "1") {
    throw new Error(`路线规划失败: ${data.info || "未知错误"}`);
  }

  const routes: RouteResult[] = [];

  if (mode === "walking") {
    const path = data.route?.paths?.[0];
    if (!path) throw new Error("未找到步行路线");
    routes.push(parsePath(path, origin, destination));
  } else if (mode === "driving") {
    const paths = data.route?.paths ?? [];
    for (const path of paths.slice(0, 3)) {
      routes.push(parsePath(path, origin, destination));
    }
  } else if (mode === "riding") {
    const path: AmapRidingPath | undefined = data.data?.paths?.[0];
    if (!path) throw new Error("未找到骑行路线");
    routes.push({
      origin,
      destination,
      distance: Number(path.distance) || 0,
      duration: Number(path.duration) || 0,
      steps: (path.steps ?? []).map((s) => ({
        instruction: s.instruction ?? "",
        road: s.road ?? undefined,
        distance: Number(s.distance) || 0,
        duration: Number(s.duration) || 0,
      })),
    });
  } else if (mode === "transit") {
    const dt = data.route?.transits ?? [];
    for (const transit of dt.slice(0, 3)) {
      const distance = Number(transit.distance) || 0;
      const duration = Number(transit.duration) || 0;
      const steps: RouteStep[] = [];
      for (const seg of transit.segments ?? []) {
        if (seg.walking) {
          steps.push({
            instruction: `步行 ${seg.walking.distance}m`,
            distance: Number(seg.walking.distance) || 0,
            duration: Number(seg.walking.duration) || 0,
          });
        }
        if (seg.bus?.buslines?.[0]) {
          const bus = seg.bus.buslines[0];
          steps.push({
            instruction: `乘坐 ${bus.name}，${bus.departure_stop?.name ?? "上车站"} → ${bus.arrival_stop?.name ?? "下车站"}`,
            distance: Number(bus.distance) || 0,
            duration: Number(bus.duration) || 0,
          });
        }
      }
      routes.push({ origin, destination, distance, duration, steps });
    }
  }

  return routes;
}

function parsePath(path: AmapPath, origin: string, destination: string): RouteResult {
  const steps: RouteStep[] = (path.steps ?? []).map((s) => ({
    instruction: s.instruction ?? "",
    road: s.road ?? undefined,
    distance: Number(s.distance) || 0,
    duration: Number(s.duration) || 0,
  }));
  return {
    origin,
    destination,
    distance: Number(path.distance) || 0,
    duration: Number(path.duration) || 0,
    steps,
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}小时${m > 0 ? m + "分钟" : ""}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}米`;
  return `${(meters / 1000).toFixed(1)}公里`;
}

export const routePlanningTool: AgentTool = {
  name: "plan_route",
  label: "路线规划",
  description:
    "规划从当前位置到目的地的路线。支持步行、驾车、骑行和公交。当用户问'怎么去XX'、'从这里到XX多远'、或需要导航路线时调用。",
  parameters: {
    type: "object",
    properties: {
      destination_lat: {
        type: "number",
        description: "目的地纬度",
      },
      destination_lng: {
        type: "number",
        description: "目的地经度",
      },
      destination_name: {
        type: "string",
        description: "目的地名称（用于显示）",
      },
      mode: {
        type: "string",
        enum: ["walking", "driving", "riding", "transit"],
        description: "出行方式：walking=步行, driving=驾车, riding=骑行, transit=公交。默认步行。",
      },
    },
    required: ["destination_lat", "destination_lng", "destination_name"],
  },
  execute: async (_id, params): Promise<AgentToolResult> => {
    const destLat = params.destination_lat as number;
    const destLng = params.destination_lng as number;
    const destName = params.destination_name as string;
    const mode = (params.mode as string) ?? "walking";

    const pos = await getCurrentPosition();
    const routes = await planRoute(pos.latitude, pos.longitude, destLat, destLng, mode as "walking" | "driving" | "riding" | "transit");

    if (routes.length === 0) {
      return {
        content: [{ type: "text", text: `未找到前往"${destName}"的路线。` }],
      };
    }

    const modeLabel: Record<string, string> = {
      walking: "步行",
      driving: "驾车",
      riding: "骑行",
      transit: "公交",
    };

    const lines = routes
      .slice(0, 2)
      .map((route, i) => {
        const parts = [
          `路线${routes.length > 1 ? i + 1 : ""}（${modeLabel[mode] ?? mode}）`,
          `距离: ${formatDistance(route.distance)} | 预计: ${formatDuration(route.duration)}`,
        ];
        if (route.steps.length > 0) {
          parts.push("路线步骤:");
          route.steps.slice(0, 8).forEach((step, j) => {
            parts.push(`  ${j + 1}. ${step.instruction}`);
          });
          if (route.steps.length > 8) {
            parts.push(`  ...共 ${route.steps.length} 步`);
          }
        }
        return parts.join("\n");
      });

    return {
      content: [{ type: "text", text: lines.join("\n\n") }],
      details: routes,
    };
  },
};
