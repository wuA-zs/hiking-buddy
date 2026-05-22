# Agent 配置页面 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an Agent configuration page with persona customization and full skill management (enable/disable, edit, add, delete).

**Architecture:** New independent pages added to the existing expo-router Stack. Persona config and disabled-skills stored in AsyncStorage alongside existing config. System prompt built dynamically from stored persona on app init. Skill editing reuses the existing `skillStore.save()/remove()` user-override mechanism.

**Tech Stack:** React Native, expo-router v5, @react-native-async-storage/async-storage, expo-linear-gradient, @expo/vector-icons (Ionicons)

---

### Task 1: Add persona and disabled-skills storage to config

**Files:**
- Modify: `src/lib/config.ts`

**Step 1: Add AgentPersona type and storage keys**

Append to `src/lib/config.ts` after the existing `setAmapKey` function:

```typescript
// ── Agent Persona ──────────────────────────────────────────

export interface AgentPersona {
  name: string;
  userAddress: string;
  personality: string;
}

const KEY_PERSONA = "agent_persona";
const KEY_DISABLED_SKILLS = "disabled_skills";

export const DEFAULT_PERSONA: AgentPersona = {
  name: "小Pi",
  userAddress: "朋友",
  personality: "热情、幽默、像朋友",
};

export async function getPersona(): Promise<AgentPersona> {
  const raw = await getItem(KEY_PERSONA);
  if (!raw) return { ...DEFAULT_PERSONA };
  try {
    return { ...DEFAULT_PERSONA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PERSONA };
  }
}

export async function setPersona(persona: AgentPersona): Promise<void> {
  await setItem(KEY_PERSONA, JSON.stringify(persona));
}

export async function getDisabledSkills(): Promise<string[]> {
  const raw = await getItem(KEY_DISABLED_SKILLS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setDisabledSkills(names: string[]): Promise<void> {
  await setItem(KEY_DISABLED_SKILLS, JSON.stringify(names));
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 2: Make system prompt dynamic

**Files:**
- Modify: `app/index.tsx` (lines 40-50 SYSTEM_PROMPT, lines 77-114 initAgent)

**Step 1: Replace hardcoded SYSTEM_PROMPT with a function**

Replace the `const SYSTEM_PROMPT = ...` block (lines 40-50) with:

```typescript
function buildSystemPrompt(persona: AgentPersona): string {
  return `你是一个手机徒步搭子应用的核心 AI 向导"${persona.name}"。

你陪伴用户徒步旅行，像一位知识渊博且热情的朋友。
你可以通过工具获取用户的位置、搜索附近景点、查询天气。
用户可以拍照发给你，你会识别并讲解照片中的内容。

你的性格：${persona.personality}。
称呼用户为"${persona.userAddress}"。

重要规则：
- 用中文回复，除非用户说其他语言
- 回复简洁（3-5 句话），用户可以追问
- 不确定的事情直接说不知道，不要编造
- 关心用户安全，遇到恶劣天气或危险地形主动提醒`;
}
```

Add import at top: `import { getPersona, type AgentPersona } from "../src/lib/config";`

**Step 2: Update initAgent to load persona and filter disabled skills**

In `initAgent()`, after `const model = await getModel();`, add persona loading and update the agent creation:

```typescript
      const persona = await getPersona();
      const disabledNames = await getDisabledSkills();

      // Load bundled skills
      const loadedSkills = loadSkills(bundledSkills);

      // Filter out disabled skills
      const enabledSkills = loadedSkills.filter((s: Skill) => !disabledNames.includes(s.name));

      // Load user skills from storage
      const userSkills = await skillStore.load();

      // Merge: user skills override bundled skills with same name
      const skillMap = new Map<string, Skill>();
      for (const s of enabledSkills) skillMap.set(s.name, s);
      for (const s of userSkills) {
        if (!disabledNames.includes(s.name)) skillMap.set(s.name, s);
      }
      const allSkills = Array.from(skillMap.values());

      const systemPrompt = buildSystemPrompt(persona);
      const tools = createHikingTools(() => agentRef.current?.getSkills() ?? allSkills);
      const agent = new Agent({ apiKey, baseURL, model, systemPrompt, tools, skills: allSkills });
```

Also add import: `import { getDisabledSkills } from "../src/lib/config";`

Remove old lines that `loadSkills(bundledSkills)` and the manual skill map merge were doing.

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 3: Add routes to _layout.tsx

**Files:**
- Modify: `app/_layout.tsx`

**Step 1: Add two new Stack.Screen entries**

```typescript
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      <Stack.Screen name="agent-config" options={{ presentation: "modal" }} />
      <Stack.Screen name="skill-edit" />
    </Stack>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 4: Add agent-config entry icon to index.tsx header

**Files:**
- Modify: `app/index.tsx` (header section, around line 330)

**Step 1: Add person icon button to headerActions**

In the headerActions View, add a new TouchableOpacity before the settings button:

```tsx
<TouchableOpacity
  onPress={() => router.push("/agent-config")}
  style={styles.headerBtn}
  accessibilityLabel="Agent 配置"
  accessibilityRole="button"
>
  <Ionicons name="person-circle-outline" size={20} color="#fff" />
</TouchableOpacity>
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 5: Create agent-config.tsx page

**Files:**
- Create: `app/agent-config.tsx`

This is the main config page with persona settings and skill list. It follows the exact same UI patterns as `app/settings.tsx` (gradient header, card sections, same theme tokens).

**Step 1: Write the full page**

The page contains:
1. Gradient header with back button and title "Agent 配置"
2. Persona card with 3 TextInputs (name, userAddress, personality)
3. Skills card with Switch list and "add" button
4. Save button

Key imports: `useRouter` from expo-router for navigation, `useLocalSearchParams` for skill-edit params, persona and skill storage functions, all bundled skills for display.

Full component structure:

```tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Switch, ScrollView, Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getPersona, setPersona, getDisabledSkills, setDisabledSkills, type AgentPersona } from "../src/lib/config";
import { skillStore } from "../src/agent/skill-store";
import { loadSkills } from "../src/agent/skills";
import { bundledSkills } from "../src/skills/index";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";
import type { Skill } from "../src/agent/types";

export default function AgentConfigScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: Colors, isDark } = useTheme();

  // Persona state
  const [name, setName] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [personality, setPersonality] = useState("");

  // Skills state
  const [skills, setSkills] = useState<Skill[]>([]);
  const [disabledNames, setDisabledNames] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  // Also reload when returning from skill-edit
  const loadData = useCallback(async () => {
    const persona = await getPersona();
    setName(persona.name);
    setUserAddress(persona.userAddress);
    setPersonality(persona.personality);

    const disabled = await getDisabledSkills();
    setDisabledNames(disabled);

    const bundled = loadSkills(bundledSkills);
    const user = await skillStore.load();
    const map = new Map<string, Skill>();
    for (const s of bundled) map.set(s.name, s);
    for (const s of user) map.set(s.name, s);
    setSkills(Array.from(map.values()));
  }, []);

  async function handleSave() {
    await setPersona({ name: name.trim(), userAddress: userAddress.trim(), personality: personality.trim() });
    await setDisabledSkills(disabledNames);
    Alert.alert("已保存", "配置已保存，重新进入对话后生效");
  }

  function toggleSkill(skillName: string) {
    setDisabledNames((prev) =>
      prev.includes(skillName) ? prev.filter((n) => n !== skillName) : [...prev, skillName]
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
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md + 2,
          paddingTop: insets.top + Spacing.sm,
          ...Shadows.md,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: Spacing.md }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: FontSize.xxl, fontWeight: "700", color: "#fff" }}>Agent 配置</Text>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        {/* Persona Card */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm }}>
            <Ionicons name="person-outline" size={18} color={Colors.primary} />
            <Text style={{ fontSize: FontSize.lg, fontWeight: "600", color: Colors.textPrimary }}>身份设置</Text>
          </View>

          <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.xs }}>代理名称</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.bg, marginBottom: Spacing.md }}
            value={name}
            onChangeText={setName}
            placeholder="小Pi"
            placeholderTextColor={Colors.textTertiary}
          />

          <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.xs }}>对用户称呼</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.bg, marginBottom: Spacing.md }}
            value={userAddress}
            onChangeText={setUserAddress}
            placeholder="朋友"
            placeholderTextColor={Colors.textTertiary}
          />

          <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.xs }}>性格描述</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.bg, minHeight: 80, textAlignVertical: "top" }}
            value={personality}
            onChangeText={setPersonality}
            placeholder="热情、幽默、像朋友"
            placeholderTextColor={Colors.textTertiary}
            multiline
          />
        </View>

        {/* Skills Card */}
        <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm }}>
            <Ionicons name="extension-puzzle-outline" size={18} color={Colors.primary} />
            <Text style={{ fontSize: FontSize.lg, fontWeight: "600", color: Colors.textPrimary }}>Skills</Text>
          </View>

          {skills.map((skill) => {
            const isDisabled = disabledNames.includes(skill.name);
            return (
              <TouchableOpacity
                key={skill.name}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider }}
                onPress={() => router.push({ pathname: "/skill-edit", params: { name: skill.name } })}
                activeOpacity={0.6}
              >
                <Switch
                  value={!isDisabled}
                  onValueChange={() => toggleSkill(skill.name)}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={!isDisabled ? Colors.primary : "#fff"}
                  style={{ marginRight: Spacing.md }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FontSize.md, fontWeight: "600", color: Colors.textPrimary }}>{skill.name}</Text>
                  <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary }} numberOfLines={1}>{skill.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            );
          })}

          {/* Add custom skill button */}
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, marginTop: Spacing.sm, gap: Spacing.xs }}
            onPress={() => router.push("/skill-edit")}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={{ fontSize: FontSize.md, color: Colors.primary, fontWeight: "600" }}>添加自定义 Skill</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, borderRadius: Radius.lg, padding: Spacing.md + 2, backgroundColor: Colors.primary, ...Shadows.md }}
          onPress={handleSave}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: FontSize.md, fontWeight: "600" }}>保存配置</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 6: Create skill-edit.tsx page

**Files:**
- Create: `app/skill-edit.tsx`

This page handles both editing existing skills (bundled or user) and creating new custom skills.

Key behaviors:
- Receives `name` param via router params (optional — absent means "new skill")
- Loads skill content from bundled skills + user overrides
- "Reset to default" shown only when skill is bundled AND has a user override
- "Delete" shown only for user-created skills (not bundled overrides)

**Step 1: Write the full page**

```tsx
import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { skillStore } from "../src/agent/skill-store";
import { loadSkills, parseFrontmatter } from "../src/agent/skills";
import { bundledSkills } from "../src/skills/index";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";
import type { Skill } from "../src/agent/types";

export default function SkillEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const insets = useSafeAreaInsets();
  const { colors: Colors, isDark } = useTheme();

  const isNew = !params.name;
  const [skillName, setSkillName] = useState(params.name ?? "");
  const [content, setContent] = useState("");
  const [bundledContent, setBundledContent] = useState<string | null>(null);
  const [isUserCreated, setIsUserCreated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSkill();
  }, []);

  async function loadSkill() {
    if (isNew) {
      setLoading(false);
      return;
    }

    // Check user skills first
    const userSkills = await skillStore.load();
    const userSkill = userSkills.find((s) => s.name === params.name);

    // Get bundled content
    const bundled = loadSkills(bundledSkills);
    const bundledSkill = bundled.find((s) => s.name === params.name);

    if (userSkill) {
      // Reconstruct full content with frontmatter
      const full = `---\nname: ${userSkill.name}\ndescription: ${userSkill.description}\n---\n\n${userSkill.content}`;
      setContent(full);
      setIsUserCreated(!bundledSkill);
      if (bundledSkill) {
        setBundledContent(`---\nname: ${bundledSkill.name}\ndescription: ${bundledSkill.description}\n---\n\n${bundledSkill.content}`);
      }
    } else if (bundledSkill) {
      const full = `---\nname: ${bundledSkill.name}\ndescription: ${bundledSkill.description}\n---\n\n${bundledSkill.content}`;
      setContent(full);
    }

    setLoading(false);
  }

  async function handleSave() {
    const { frontmatter, body } = parseFrontmatter(content);
    const name = frontmatter.name || skillName.trim();
    if (!name) {
      Alert.alert("请填写 skill 名称");
      return;
    }

    const skill: Skill = {
      name,
      description: frontmatter.description ?? "",
      content: body,
      source: "user",
    };

    await skillStore.save(skill);
    Alert.alert("已保存", isNew ? "自定义 skill 已添加" : "Skill 已更新", [
      { text: "确定", onPress: () => router.back() },
    ]);
  }

  async function handleReset() {
    if (!bundledContent) return;
    setContent(bundledContent);
    // Remove the user override
    if (params.name) {
      await skillStore.remove(params.name);
    }
    Alert.alert("已重置", "已恢复为默认内容");
  }

  async function handleDelete() {
    Alert.alert("确认删除", `确定要删除 "${skillName}" 吗？`, [
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
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
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md + 2,
          paddingTop: insets.top + Spacing.sm,
          ...Shadows.md,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: Spacing.md }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: FontSize.xxl, fontWeight: "700", color: "#fff" }} numberOfLines={1}>
          {isNew ? "新建 Skill" : skillName}
        </Text>
      </LinearGradient>

      <View style={{ flex: 1, padding: Spacing.lg }}>
        {/* Name input (editable only for new skills) */}
        {isNew && (
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.xs }}>Skill 名称</Text>
            <TextInput
              style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.surface }}
              value={skillName}
              onChangeText={setSkillName}
              placeholder="my-custom-skill"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Content editor */}
        <Text style={{ fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.xs }}>内容（YAML frontmatter + Markdown）</Text>
        <TextInput
          style={{
            flex: 1,
            borderWidth: 1.5,
            borderColor: Colors.border,
            borderRadius: Radius.md,
            padding: Spacing.md,
            fontSize: FontSize.sm,
            fontFamily: "monospace",
            color: Colors.textPrimary,
            backgroundColor: Colors.surface,
            textAlignVertical: "top",
          }}
          value={content}
          onChangeText={setContent}
          placeholder={"---\nname: my-skill\ndescription: 描述\n---\n\n# 指令内容"}
          placeholderTextColor={Colors.textTertiary}
          multiline
          autoFocus={isNew}
        />

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md }}>
          {/* Save */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, borderRadius: Radius.lg, padding: Spacing.md + 2, backgroundColor: Colors.primary, ...Shadows.md }}
            onPress={handleSave}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontSize: FontSize.md, fontWeight: "600" }}>保存</Text>
          </TouchableOpacity>

          {/* Reset to default (bundled skills with user override) */}
          {bundledContent && !isUserCreated && (
            <TouchableOpacity
              style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, borderWidth: 1.5, borderColor: Colors.warning, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md + 2 }}
              onPress={handleReset}
            >
              <Ionicons name="refresh-outline" size={18} color={Colors.warning} />
              <Text style={{ color: Colors.warning, fontSize: FontSize.md, fontWeight: "600" }}>重置</Text>
            </TouchableOpacity>
          )}

          {/* Delete (user-created skills only) */}
          {isUserCreated && (
            <TouchableOpacity
              style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.xs, borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md + 2 }}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
              <Text style={{ color: Colors.error, fontSize: FontSize.md, fontWeight: "600" }}>删除</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 7: Full integration test

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 2: Manual verification checklist**

1. Open app → header should show person icon next to settings gear
2. Tap person icon → agent-config modal opens
3. Edit persona name/call/personality → save → shows alert
4. Toggle skill switches on/off
5. Tap a skill → skill-edit page opens with content
6. Edit content → save → returns to agent-config
7. Tap "添加自定义 Skill" → empty editor opens
8. Create new skill with frontmatter → save → appears in list
9. Kill and restart app → new conversation uses updated persona and skills
