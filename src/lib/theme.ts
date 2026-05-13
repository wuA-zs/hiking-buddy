/**
 * Shared theme — colors, spacing, typography, helpers
 */

// ── Color Palette ────────────────────────────────────────────

export const Colors = {
  // Primary (forest green gradient)
  primary: "#2d6a4f",
  primaryDark: "#1b4332",
  primaryLight: "#52b788",
  primaryAlpha20: "rgba(45,106,79,0.20)",

  // Backgrounds
  bg: "#f8faf8",
  bgDark: "#0f1419",
  surface: "#ffffff",
  surfaceAlt: "#f0f4f0",

  // Text
  textPrimary: "#1a1a1a",
  textSecondary: "#4a5568",
  textTertiary: "#94a3b8",
  textOnPrimary: "#ffffff",
  textOnSurface: "#333333",

  // Borders & dividers
  border: "#e2e8e0",
  divider: "#f0f0f0",

  // Semantic
  error: "#dc2626",
  warning: "#f59e0b",
  info: "#3b82f6",

  // Chat
  bubbleUser: "#2d6a4f",
  bubbleUserGradient: ["#1b4332", "#2d6a4f"] as [string, string],
  bubbleAssistant: "#ffffff",
  bubbleAssistantBorder: "#e8f0e8",
  toolCallBg: "#f0f7f4",
  toolCallBorder: "#b7e4c7",

  // Map
  mapExpandBg: "#e8f5ee",
};

// ── Spacing ──────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ── Typography ───────────────────────────────────────────────

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 22,
  title: 26,
} as const;

// ── Border Radius ────────────────────────────────────────────

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 24,
  full: 999,
} as const;

// ── Shadows ──────────────────────────────────────────────────

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// ── Helpers ──────────────────────────────────────────────────

export const TOOL_CALL_LABELS: Record<string, string> = {
  get_location: "📍 获取位置中",
  search_nearby: "🔍 搜索附近",
  get_weather: "🌤️ 查询天气",
  get_trail_info: "🥾 查询步道",
  plan_route: "🗺️ 规划路线",
  plan_travel: "📋 规划行程",
};

export function getToolCallLabel(name: string): string {
  return TOOL_CALL_LABELS[name] ?? `⚡ ${name}`;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
