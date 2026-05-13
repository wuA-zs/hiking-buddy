import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getApiKey, setApiKey, getBaseUrl, setBaseUrl, getModel, setModel, getAmapKey, setAmapKey } from "../src/lib/config";
import { Colors, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";

const MODEL_OPTIONS = [
  { label: "GLM-4-Plus", value: "glm-4-plus" },
  { label: "GLM-4-Flash", value: "glm-4-flash" },
  { label: "DeepSeek Chat", value: "deepseek-chat" },
  { label: "GPT-4o", value: "gpt-4o" },
  { label: "GPT-4o Mini", value: "gpt-4o-mini" },
  { label: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
];

export default function SettingsScreen() {
  const [apiKey, setApiKeyState] = useState("");
  const [baseUrl, setBaseUrlState] = useState("https://open.bigmodel.cn/api/paas/v4");
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
      if (apiKey.trim()) {
        await setApiKey(apiKey.trim());
      }
      await setBaseUrl(baseUrl.trim());
      await setModel(model);
      if (amapKey.trim()) {
        await setAmapKey(amapKey.trim());
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
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>设置</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Base URL */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="globe-outline" size={18} color={Colors.primary} />
            <Text style={styles.label}>Base URL</Text>
          </View>
          <Text style={styles.hint}>OpenAI 兼容 API 地址</Text>
          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrlState}
            placeholder="https://open.bigmodel.cn/api/paas/v4"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        {/* API Key */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="key-outline" size={18} color={Colors.primary} />
            <Text style={styles.label}>API Key</Text>
          </View>
          <Text style={styles.hint}>必填，用于 LLM 对话</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKeyState}
            placeholder="sk-..."
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>

        {/* Model */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="hardware-chip-outline" size={18} color={Colors.primary} />
            <Text style={styles.label}>模型</Text>
          </View>
          <Text style={styles.hint}>选择对话使用的模型</Text>
          <View style={styles.modelGrid}>
            {MODEL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.modelOption, model === opt.value && styles.modelOptionActive]}
                onPress={() => setModelState(opt.value)}
              >
                <Text style={[styles.modelOptionText, model === opt.value && styles.modelOptionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: Spacing.sm }]}
            value={model}
            onChangeText={setModelState}
            placeholder="或输入自定义模型名称"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Amap Key */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="map-outline" size={18} color={Colors.primary} />
            <Text style={styles.label}>高德地图 Key</Text>
          </View>
          <Text style={styles.hint}>可选，用于逆地理编码和附近搜索</Text>
          <TextInput
            style={styles.input}
            value={amapKey}
            onChangeText={setAmapKeyState}
            placeholder="高德 Web服务 API Key"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.testButton, testing && styles.buttonDisabled]}
            onPress={handleTest}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="flash-outline" size={18} color={Colors.primary} />
            )}
            <Text style={styles.testButtonText}>测试连通</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>保存配置</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={styles.about}>
          <Text style={styles.aboutTitle}>关于</Text>
          <Text style={styles.aboutText}>徒步搭子 — 你的 AI 徒步向导</Text>
          <Text style={styles.aboutText}>基于 pi-agent-core 架构，使用 Claude AI 驱动</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    paddingTop: Spacing.xxl + 10,
    ...Shadows.md,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: "#fff",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSize.lg,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.bg,
  },
  modelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  modelOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modelOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.mapExpandBg,
  },
  modelOptionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  modelOptionTextActive: {
    color: Colors.primary,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  testButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md + 2,
    backgroundColor: Colors.surface,
  },
  testButtonText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: Radius.lg,
    padding: Spacing.md + 2,
    backgroundColor: Colors.primary,
    ...Shadows.md,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  about: {
    marginTop: Spacing.xxxl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  aboutTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  aboutText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    lineHeight: 20,
  },
});
