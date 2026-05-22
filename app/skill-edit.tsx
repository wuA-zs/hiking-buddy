import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { skillStore } from "../src/agent/skill-store";
import { loadSkills, parseFrontmatter } from "../src/agent/skills";
import { bundledSkills, bundledSkillDocs } from "../src/skills/index";
import type { Skill } from "../src/agent/types";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";
import { AppIcon } from "../src/components/AppIcon";

export default function SkillEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const { colors: Colors, isDark } = useTheme();

  const isNew = !params.name;

  const [skillName, setSkillName] = useState(params.name ?? "");
  const [content, setContent] = useState("");
  const [bundledContent, setBundledContent] = useState<string | null>(null);
  const [isUserCreated, setIsUserCreated] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    loadSkill();
  }, []);

  async function loadSkill() {
    try {
      // Load user skills
      const userSkills = await skillStore.load();
      const userSkill = userSkills.find((s) => s.name === params.name);

      // Load bundled skills
      const parsed = loadSkills(bundledSkills, "bundled", bundledSkillDocs);
      const bundledSkill = parsed.find((s) => s.name === params.name);

      // Find the raw bundled content string
      let rawBundledContent: string | null = null;
      for (const [key, val] of Object.entries(bundledSkills)) {
        if (key === params.name) {
          rawBundledContent = val;
          break;
        }
      }

      if (userSkill) {
        // Reconstruct full content from user skill
        const fullContent = `---\nname: ${userSkill.name}\ndescription: ${userSkill.description}\n---\n\n${userSkill.content}`;
        setContent(fullContent);
        setIsUserCreated(!bundledSkill);
      } else if (rawBundledContent) {
        setContent(rawBundledContent);
      }

      if (rawBundledContent) {
        setBundledContent(rawBundledContent);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const { frontmatter, body } = parseFrontmatter(content);

    const name = frontmatter.name || skillName.trim();
    if (!name) {
      Alert.alert("提示", "Skill 名称不能为空");
      return;
    }

    const skill: Skill = {
      name,
      description: frontmatter.description ?? "",
      content: body,
      source: "user",
    };

    await skillStore.save(skill);
    Alert.alert("保存成功", undefined, [
      { text: "确定", onPress: () => router.back() },
    ]);
  }

  function handleReset() {
    if (!bundledContent) return;
    setContent(bundledContent);
    skillStore.remove(params.name!);
    Alert.alert("已重置");
  }

  function handleDelete() {
    Alert.alert("确定要删除吗？", undefined, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          await skillStore.remove(skillName);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: "center", alignItems: "center" }}>
        <StatusBar style={isDark ? "light" : "light"} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style={isDark ? "light" : "light"} />

      {/* Header */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2, paddingTop: insets.top + Spacing.sm, ...Shadows.md }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: Spacing.md }}>
          <AppIcon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: FontSize.xxl, fontWeight: "700", color: "#fff", flex: 1 }} numberOfLines={1}>
          {isNew ? "新建 Skill" : skillName}
        </Text>
      </LinearGradient>

      {/* Body */}
      <View style={{ flex: 1, padding: Spacing.lg }}>
        {/* Name input for new skills */}
        {isNew && (
          <View style={{ marginBottom: Spacing.lg }}>
            <Text style={{ fontSize: FontSize.md, fontWeight: "600", color: Colors.textPrimary, marginBottom: Spacing.sm }}>
              名称
            </Text>
            <TextInput
              style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.surface }}
              value={skillName}
              onChangeText={setSkillName}
              placeholder="my-skill"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Content label */}
        <Text style={{ fontSize: FontSize.md, fontWeight: "600", color: Colors.textPrimary, marginBottom: Spacing.sm }}>
          内容（YAML frontmatter + Markdown）
        </Text>

        {/* Content editor */}
        <TextInput
          style={{ flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.sm, color: Colors.textPrimary, backgroundColor: Colors.surface, fontFamily: "monospace", textAlignVertical: "top" }}
          value={content}
          onChangeText={setContent}
          placeholder={"---\nname: my-skill\ndescription: 描述\n---\n\n# 指令内容"}
          placeholderTextColor={Colors.textTertiary}
          multiline
        />

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg }}>
          {/* Save button */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, borderRadius: Radius.lg, padding: Spacing.md + 2, backgroundColor: Colors.primary, ...Shadows.md }}
            onPress={handleSave}
          >
            <AppIcon name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontSize: FontSize.md, fontWeight: "600" }}>保存</Text>
          </TouchableOpacity>

          {/* Reset button — only for bundled skills with user overrides */}
          {bundledContent && !isUserCreated && (
            <TouchableOpacity
              style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, borderWidth: 1.5, borderColor: Colors.warning, borderRadius: Radius.lg, padding: Spacing.md + 2, backgroundColor: Colors.surface }}
              onPress={handleReset}
            >
              <AppIcon name="refresh-outline" size={18} color={Colors.warning} />
              <Text style={{ color: Colors.warning, fontSize: FontSize.md, fontWeight: "600" }}>重置</Text>
            </TouchableOpacity>
          )}

          {/* Delete button — only for user-created skills */}
          {isUserCreated && (
            <TouchableOpacity
              style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.lg, padding: Spacing.md + 2, backgroundColor: Colors.surface }}
              onPress={handleDelete}
            >
              <AppIcon name="trash-outline" size={18} color={Colors.error} />
              <Text style={{ color: Colors.error, fontSize: FontSize.md, fontWeight: "600" }}>删除</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
