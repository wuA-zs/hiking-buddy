import { useColorScheme } from "react-native";

const LightColors = {
  primary: "#2f6f4e",
  primaryDark: "#214d39",
  primaryLight: "#79b58a",
  primaryAlpha12: "rgba(47,111,78,0.12)",
  primaryAlpha20: "rgba(47,111,78,0.20)",

  bg: "#f6f7f2",
  surface: "#ffffff",
  surfaceAlt: "#edf2e9",
  elevated: "#fbfcf8",

  textPrimary: "#17201a",
  textSecondary: "#556156",
  textTertiary: "#8a958d",
  textOnPrimary: "#ffffff",
  textOnSurface: "#263128",

  border: "#dde6da",
  divider: "#e8ede5",

  error: "#c2413b",
  warning: "#b7791f",
  info: "#3574a6",

  bubbleUser: "#2f6f4e",
  bubbleUserGradient: ["#2f6f4e", "#3f8060"] as [string, string],
  bubbleAssistant: "#ffffff",
  bubbleAssistantBorder: "#e1eadf",
  toolCallBg: "#eef6ec",
  toolCallBorder: "#c9dec5",

  mapExpandBg: "#edf5ea",
  inputBg: "#f1f4ee",
};

const DarkColors = {
  primary: "#8bcf9f",
  primaryDark: "#355f45",
  primaryLight: "#a6dcaf",
  primaryAlpha12: "rgba(139,207,159,0.12)",
  primaryAlpha20: "rgba(139,207,159,0.22)",

  bg: "#101510",
  surface: "#182019",
  surfaceAlt: "#202a21",
  elevated: "#1b241c",

  textPrimary: "#eef3ec",
  textSecondary: "#bac5b9",
  textTertiary: "#7f8c80",
  textOnPrimary: "#081108",
  textOnSurface: "#e6ece4",

  border: "#2d392e",
  divider: "#263126",

  error: "#f08a80",
  warning: "#e3b35e",
  info: "#86b9e6",

  bubbleUser: "#4d8b64",
  bubbleUserGradient: ["#3b7451", "#57936a"] as [string, string],
  bubbleAssistant: "#1b241c",
  bubbleAssistantBorder: "#314033",
  toolCallBg: "#223222",
  toolCallBorder: "#3c563d",

  mapExpandBg: "#213020",
  inputBg: "#202a21",
};

export const Colors = LightColors;

export type ThemeColors = typeof LightColors;

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return {
    colors: isDark ? DarkColors : LightColors,
    isDark,
  };
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 22,
  title: 26,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 24,
  full: 999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
} as const;

export const TOOL_CALL_LABELS: Record<string, string> = {
  get_location: "获取位置中",
  search_nearby: "搜索附近",
  get_weather: "查询天气",
  get_trail_info: "查询路线",
  plan_route: "规划路线",
  plan_travel: "规划行程",
  list_files: "浏览文件",
  read_file: "读取文件",
  create_file: "创建文件",
  update_file: "更新文件",
  delete_file: "删除文件",
};

export function getToolCallLabel(name: string): string {
  return TOOL_CALL_LABELS[name] ?? name;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
