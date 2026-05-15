import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiKey, setApiKey, getBaseUrl, setBaseUrl, getModel, setModel, getAmapKey, setAmapKey } from "../src/lib/config";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";

const MODEL_OPTIONS = [
  { label: "glm-5.1", value: "glm-5.1" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: Colors, isDark } = useTheme();
  const [apiKey, setApiKeyState] = useState("");
  const [baseUrl, setBaseUrlState] = useState("https://open.bigmodel.cn/api/coding/paas/v4");
  const [model, setModelState] = useState(MODEL_OPTIONS[0].value);
  const [amapKey, setAmapKeyState] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    const ak = await getApiKey();
    const bu = await getBaseUrl();
    const m = await getModel();
    const mk = await getAmapKey();
    if (ak) setApiKeyState(ak);
    if (bu) setBaseUrlState(bu);
    if (m) setModelState(m);
    if (mk) setAmapKeyState(mk);
  }

  async function handleSave() {
    try {
      const trimmedKey = apiKey.trim();
      const trimmedUrl = baseUrl.trim();
      const trimmedAmap = amapKey.trim();

      if (trimmedUrl) {
        try {
          new URL(trimmedUrl);
        } catch {
          Alert.alert("格式错误", "Base URL 不是有效的 URL 地址");
          return;
        }
      }

      if (trimmedKey) {
        await setApiKey(trimmedKey);
      }
      if (trimmedUrl) {
        await setBaseUrl(trimmedUrl);
      }
      await setModel(model.trim());
      if (trimmedAmap) {
        await setAmapKey(trimmedAmap);
      }
      Alert.alert("保存成功", "配置已保存，返回即可开始对话");
    } catch {
      Alert.alert("保存失败", "请重试");
    }
  }

  async function handleTest() {
    if (!apiKey.trim()) {
      Alert.alert("请先填写 API Key");
      return;
    }
    if (!baseUrl.trim()) {
      Alert.alert("请先填写 Base URL");
      return;
    }

    setTesting(true);
    try {
      const url = `${baseUrl.trim().replace(/\/+$/, "")}/chat/completions`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 16,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        Alert.alert("连接失败", `HTTP ${res.status}: ${errText}`);
        return;
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? "";
      Alert.alert(
        "连接成功",
        `模型: ${data.model}\n输入: ${data.usage?.prompt_tokens ?? "?"} tokens\n输出: ${data.usage?.completion_tokens ?? "?"} tokens\n回复: ${reply.slice(0, 50)}`
      );
    } catch (err) {
      Alert.alert("连接失败", err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style={isDark ? "light" : "light"} />

      {/* Header */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2, paddingTop: insets.top + Spacing.sm, ...Shadows.md }}
      >
        <Text style={{ fontSize: FontSize.xxl, fontWeight: "700", color: "#fff" }}>设置</Text>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        {/* Base URL */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs }}>
            <Ionicons name="globe-outline" size={18} color={Colors.primary} />
            <Text style={{ fontSize: FontSize.lg, fontWeight: "600", color: Colors.textPrimary }}>Base URL</Text>
          </View>
          <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md }}>OpenAI 兼容 API 地址</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.bg }}
            value={baseUrl}
            onChangeText={setBaseUrlState}
            placeholder="https://open.bigmodel.cn/api/paas/v4"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Base URL"
          />
        </View>

        {/* API Key */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs }}>
            <Ionicons name="key-outline" size={18} color={Colors.primary} />
            <Text style={{ fontSize: FontSize.lg, fontWeight: "600", color: Colors.textPrimary }}>API Key</Text>
          </View>
          <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md }}>必填，用于 LLM 对话</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.bg }}
            value={apiKey}
            onChangeText={setApiKeyState}
            placeholder="sk-..."
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            accessibilityLabel="API Key"
          />
        </View>

        {/* Model */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs }}>
            <Ionicons name="hardware-chip-outline" size={18} color={Colors.primary} />
            <Text style={{ fontSize: FontSize.lg, fontWeight: "600", color: Colors.textPrimary }}>模型</Text>
          </View>
          <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md }}>选择对话使用的模型</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
            {MODEL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={{
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  borderRadius: Radius.pill,
                  borderWidth: 1.5,
                  borderColor: model === opt.value ? Colors.primary : Colors.border,
                  backgroundColor: model === opt.value ? Colors.mapExpandBg : Colors.surface,
                }}
                onPress={() => setModelState(opt.value)}
              >
                <Text style={{ fontSize: FontSize.sm, color: model === opt.value ? Colors.primary : Colors.textSecondary, fontWeight: model === opt.value ? "600" : "400" }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.bg, marginTop: Spacing.sm }}
            value={model}
            onChangeText={setModelState}
            placeholder="或输入自定义模型名称"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Amap Key */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs }}>
            <Ionicons name="map-outline" size={18} color={Colors.primary} />
            <Text style={{ fontSize: FontSize.lg, fontWeight: "600", color: Colors.textPrimary }}>高德地图 Key</Text>
          </View>
          <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md }}>可选，用于逆地理编码和附近搜索</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.bg }}
            value={amapKey}
            onChangeText={setAmapKeyState}
            placeholder="高德 Web服务 API Key"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Buttons */}
        <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm }}>
          <TouchableOpacity
            style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md + 2, backgroundColor: Colors.surface, opacity: testing ? 0.6 : 1 }}
            onPress={handleTest}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="flash-outline" size={18} color={Colors.primary} />
            )}
            <Text style={{ color: Colors.primary, fontSize: FontSize.md, fontWeight: "600" }}>测试连通</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, borderRadius: Radius.lg, padding: Spacing.md + 2, backgroundColor: Colors.primary, ...Shadows.md }}
            onPress={handleSave}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontSize: FontSize.md, fontWeight: "600" }}>保存配置</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={{ marginTop: Spacing.xxxl, paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.divider }}>
          <Text style={{ fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary, marginBottom: Spacing.sm }}>关于</Text>
          <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, lineHeight: 20 }}>徒步搭子 — 你的 AI 徒步向导</Text>
          <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, lineHeight: 20 }}>基于 pi-agent-core 架构，使用 AI 驱动</Text>
        </View>
      </ScrollView>
    </View>
  );
}
