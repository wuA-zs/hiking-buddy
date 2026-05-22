import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  getPersona,
  setPersona,
  getDisabledSkills,
  setDisabledSkills,
} from "../src/lib/config";
import type { AgentPersona } from "../src/lib/config";
import { skillStore } from "../src/agent/skill-store";
import { loadSkills } from "../src/agent/skills";
import { bundledSkills, bundledSkillDocs } from "../src/skills/index";
import type { Skill } from "../src/agent/types";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";
import { AppIcon } from "../src/components/AppIcon";

export default function AgentConfigScreen() {
  const insets = useSafeAreaInsets();
  const { colors: Colors, isDark } = useTheme();
  const router = useRouter();

  const [name, setName] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [personality, setPersonality] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [disabledNames, setDisabledNames] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const persona = await getPersona();
    setName(persona.name);
    setUserAddress(persona.userAddress);
    setPersonality(persona.personality);

    const disabled = await getDisabledSkills();
    setDisabledNames(disabled);

    const bundled = loadSkills(bundledSkills, "bundled", bundledSkillDocs);
    const user = await skillStore.load();

    // Merge: user overrides bundled by name
    const map = new Map<string, Skill>();
    for (const s of bundled) {
      map.set(s.name, s);
    }
    for (const s of user) {
      map.set(s.name, s);
    }
    setSkills(Array.from(map.values()));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSave() {
    setPersona({ name, userAddress, personality });
    setDisabledSkills(disabledNames);
    Alert.alert("已保存", "配置已保存，重新进入对话后生效");
  }

  function toggleSkill(skillName: string) {
    setDisabledNames((prev) =>
      prev.includes(skillName)
        ? prev.filter((n) => n !== skillName)
        : [...prev, skillName],
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
        style={{
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md + 2,
          paddingTop: insets.top + Spacing.sm,
          ...Shadows.md,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppIcon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: FontSize.xxl, fontWeight: "700", color: "#fff" }}>
          Agent 配置
        </Text>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
      >
        {/* Persona Card */}
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: Radius.lg,
            padding: Spacing.lg,
            marginBottom: Spacing.lg,
            ...Shadows.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.xs,
              marginBottom: Spacing.md,
            }}
          >
            <AppIcon name="person-outline" size={18} color={Colors.primary} />
            <Text
              style={{
                fontSize: FontSize.lg,
                fontWeight: "600",
                color: Colors.textPrimary,
              }}
            >
              身份设置
            </Text>
          </View>

          {/* 代理名称 */}
          <Text
            style={{
              fontSize: FontSize.sm,
              color: Colors.textTertiary,
              marginBottom: Spacing.xs,
            }}
          >
            代理名称
          </Text>
          <TextInput
            style={{
              borderWidth: 1.5,
              borderColor: Colors.border,
              borderRadius: Radius.md,
              padding: Spacing.md,
              fontSize: FontSize.md,
              color: Colors.textPrimary,
              backgroundColor: Colors.bg,
              marginBottom: Spacing.md,
            }}
            value={name}
            onChangeText={setName}
            placeholder="小Pi"
            placeholderTextColor={Colors.textTertiary}
          />

          {/* 对用户称呼 */}
          <Text
            style={{
              fontSize: FontSize.sm,
              color: Colors.textTertiary,
              marginBottom: Spacing.xs,
            }}
          >
            对用户称呼
          </Text>
          <TextInput
            style={{
              borderWidth: 1.5,
              borderColor: Colors.border,
              borderRadius: Radius.md,
              padding: Spacing.md,
              fontSize: FontSize.md,
              color: Colors.textPrimary,
              backgroundColor: Colors.bg,
              marginBottom: Spacing.md,
            }}
            value={userAddress}
            onChangeText={setUserAddress}
            placeholder="朋友"
            placeholderTextColor={Colors.textTertiary}
          />

          {/* 性格描述 */}
          <Text
            style={{
              fontSize: FontSize.sm,
              color: Colors.textTertiary,
              marginBottom: Spacing.xs,
            }}
          >
            性格描述
          </Text>
          <TextInput
            style={{
              borderWidth: 1.5,
              borderColor: Colors.border,
              borderRadius: Radius.md,
              padding: Spacing.md,
              fontSize: FontSize.md,
              color: Colors.textPrimary,
              backgroundColor: Colors.bg,
              minHeight: 80,
              textAlignVertical: "top",
            }}
            value={personality}
            onChangeText={setPersonality}
            placeholder="热情、幽默、像朋友"
            placeholderTextColor={Colors.textTertiary}
            multiline
          />
        </View>

        {/* Skills Card */}
        <View
          style={{
            backgroundColor: Colors.surface,
            borderRadius: Radius.lg,
            padding: Spacing.lg,
            marginBottom: Spacing.lg,
            ...Shadows.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.xs,
              marginBottom: Spacing.md,
            }}
          >
            <AppIcon
              name="extension-puzzle-outline"
              size={18}
              color={Colors.primary}
            />
            <Text
              style={{
                fontSize: FontSize.lg,
                fontWeight: "600",
                color: Colors.textPrimary,
              }}
            >
              Skills
            </Text>
          </View>

          {skills.map((skill) => {
            const isEnabled = !disabledNames.includes(skill.name);
            return (
              <TouchableOpacity
                key={skill.name}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: Spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.divider,
                  gap: Spacing.sm,
                }}
                onPress={() =>
                  router.push({
                    pathname: "/skill-edit",
                    params: { name: skill.name },
                  })
                }
              >
                <Switch
                  value={isEnabled}
                  onValueChange={() => toggleSkill(skill.name)}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={isEnabled ? Colors.primary : "#fff"}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: FontSize.md,
                      fontWeight: "600",
                      color: Colors.textPrimary,
                    }}
                  >
                    {skill.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: FontSize.sm,
                      color: Colors.textTertiary,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {skill.description}
                  </Text>
                </View>
                <AppIcon
                  name="chevron-forward-outline"
                  size={18}
                  color={Colors.textTertiary}
                />
              </TouchableOpacity>
            );
          })}

          {/* Add custom skill button */}
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: Spacing.xs,
              paddingVertical: Spacing.md,
              marginTop: Spacing.sm,
            }}
            onPress={() => router.push("/skill-edit")}
          >
            <AppIcon
              name="sparkles-outline"
              size={20}
              color={Colors.primary}
            />
            <Text
              style={{
                fontSize: FontSize.md,
                color: Colors.primary,
                fontWeight: "600",
              }}
            >
              添加自定义 Skill
            </Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: Spacing.xs,
            borderRadius: Radius.lg,
            padding: Spacing.md + 4,
            overflow: "hidden",
            ...Shadows.md,
          }}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.primaryDark, Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <AppIcon name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: FontSize.md, fontWeight: "600" }}>
            保存配置
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
