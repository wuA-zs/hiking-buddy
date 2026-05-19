# Pi-Style Skill System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the skill system to match Pi's architecture — progressive disclosure via system prompt metadata + `load_skill` tool, with user-added skill support via local storage.

**Architecture:** Skills are split into "bundled" (TypeScript constants) and "user" (AsyncStorage). Only metadata (name + description) is injected into the system prompt. The model calls a `load_skill` tool to fetch full skill content on demand. A `SkillStore` interface abstracts persistence for user skills.

**Tech Stack:** TypeScript, React Native (Expo), AsyncStorage, OpenAI-compatible tool calling

---

### Task 1: Update Skill Type

**Files:**
- Modify: `src/agent/types.ts:108-113`

**Step 1: Update the Skill interface**

Replace the existing `Skill` interface in `src/agent/types.ts`:

```typescript
export interface Skill {
  name: string;
  description: string;
  content: string;
  source: "bundled" | "user";
  disableModelInvocation?: boolean;
}
```

Remove `filePath`, add `source` and `disableModelInvocation`.

**Step 2: Verify no compile errors**

Run: `npx tsc --noEmit` from project root.
Expected: Errors in files referencing `filePath` or missing `source` — that's expected, will fix in subsequent tasks.

**Step 3: Commit**

```bash
git add src/agent/types.ts
git commit -m "feat(skills): update Skill type to match Pi architecture"
```

---

### Task 2: Update Skill Loader

**Files:**
- Modify: `src/agent/skills.ts:46-58`

**Step 1: Update `loadSkills` to accept source parameter**

The function signature changes to accept an optional `source` parameter:

```typescript
export function loadSkills(
  skillContents: Record<string, string>,
  source: "bundled" | "user" = "bundled",
): Skill[] {
  const skills: Skill[] = [];
  for (const [name, content] of Object.entries(skillContents)) {
    const { frontmatter, body } = parseFrontmatter(content);
    skills.push({
      name: frontmatter.name ?? name,
      description: frontmatter.description ?? "",
      content: body,
      source,
      disableModelInvocation: frontmatter["disable-model-invocation"] === "true",
    });
  }
  return skills;
}
```

**Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: Fewer errors than Task 1.

**Step 3: Commit**

```bash
git add src/agent/skills.ts
git commit -m "feat(skills): update loadSkills to support source parameter"
```

---

### Task 3: Refactor formatSkillsForSystemPrompt to Progressive Disclosure

**Files:**
- Modify: `src/agent/skills.ts:64-94`

**Step 1: Replace the full-content-inlining with metadata-only output**

Replace the entire `formatSkillsForSystemPrompt` function body:

```typescript
export function formatSkillsForSystemPrompt(skills: Skill[]): string {
  const visible = skills.filter((s) => !s.disableModelInvocation);
  if (visible.length === 0) return "";

  const lines = [
    "",
    "The following skills provide specialized instructions for specific tasks.",
    "当任务匹配某个 skill 的 description 时，调用 load_skill 工具获取完整指令内容。",
    "",
    "<available_skills>",
  ];

  for (const skill of visible) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeXml(skill.name)}</name>`);
    lines.push(`    <description>${escapeXml(skill.description)}</description>`);
    lines.push("  </skill>");
  }

  lines.push("</available_skills>");

  return lines.join("\n");
}
```

Key change: **Removed the loop that inlined full skill content** (lines 86-92 of original). Only metadata goes into system prompt now.

**Step 2: Verify compile**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/agent/skills.ts
git commit -m "feat(skills): progressive disclosure — only metadata in system prompt"
```

---

### Task 4: Create SkillStore

**Files:**
- Create: `src/agent/skill-store.ts`

**Step 1: Write the SkillStore module**

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Skill } from "./types";
import { parseFrontmatter } from "./skills";

const STORAGE_KEY = "user_skills";

export const skillStore = {
  async load(): Promise<Skill[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const items: Array<{ name: string; description: string; content: string; disableModelInvocation?: boolean }> = JSON.parse(raw);
      return items.map((item) => ({
        ...item,
        source: "user" as const,
      }));
    } catch {
      return [];
    }
  },

  async save(skill: Skill): Promise<void> {
    const skills = await this.load();
    const idx = skills.findIndex((s) => s.name === skill.name);
    if (idx >= 0) {
      skills[idx] = { ...skill, source: "user" };
    } else {
      skills.push({ ...skill, source: "user" });
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
  },

  async remove(name: string): Promise<void> {
    const skills = await this.load();
    const filtered = skills.filter((s) => s.name !== name);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  async list(): Promise<Skill[]> {
    return this.load();
  },
};
```

**Step 2: Export parseFrontmatter from skills.ts**

In `src/agent/skills.ts`, add `export` keyword to the `parseFrontmatter` function:

Change:
```typescript
function parseFrontmatter(raw: string):
```
To:
```typescript
export function parseFrontmatter(raw: string):
```

**Step 3: Verify compile**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/agent/skill-store.ts src/agent/skills.ts
git commit -m "feat(skills): add SkillStore for user-added skills with AsyncStorage"
```

---

### Task 5: Create load_skill Tool

**Files:**
- Create: `src/tools/load-skill.ts`

**Step 1: Write the load_skill tool**

```typescript
import type { AgentTool, Skill } from "../agent/types";

export function createLoadSkillTool(getSkills: () => Skill[]): AgentTool {
  return {
    name: "load_skill",
    label: "加载技能",
    description:
      "按名称加载 skill 的完整指令内容。当用户任务匹配某个 skill 的描述时调用此工具获取详细指令。",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "要加载的 skill 名称，如 'hiking-guide'、'photo-explainer'",
        },
      },
      required: ["name"],
    },
    execute: async (_toolCallId, params) => {
      const skills = getSkills();
      const skill = skills.find((s) => s.name === params.name);
      if (!skill) {
        const available = skills.map((s) => s.name).join(", ");
        return {
          content: [{ type: "text" as const, text: `未找到 skill: ${params.name}。可用的 skill: ${available}` }],
        };
      }
      return {
        content: [{ type: "text" as const, text: skill.content }],
      };
    },
  };
}
```

Note: `getSkills` is a getter function so the tool always accesses the current skill list, even after `reloadSkills()`.

**Step 2: Verify compile**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/tools/load-skill.ts
git commit -m "feat(skills): add load_skill tool for progressive skill loading"
```

---

### Task 6: Update tools/index.ts to Export load_skill

**Files:**
- Modify: `src/tools/index.ts`

**Step 1: Update createHikingTools to accept skills getter**

```typescript
import type { AgentTool, Skill } from "../agent/types";
import { getLocationTool } from "./get-location";
import { getTrailInfoTool } from "./get-trail-info";
import { getWeatherTool } from "./get-weather";
import { searchNearbyTool } from "./search-nearby";
import { routePlanningTool } from "./route-planning";
import { travelPlannerTool } from "./travel-planner";
import { createLoadSkillTool } from "./load-skill";

export function createHikingTools(getSkills: () => Skill[]): AgentTool[] {
  return [
    getLocationTool,
    searchNearbyTool,
    getWeatherTool,
    getTrailInfoTool,
    routePlanningTool,
    travelPlannerTool,
    createLoadSkillTool(getSkills),
  ];
}
```

**Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: Error in `app/index.tsx` because `createHikingTools` now requires an argument — will fix in Task 8.

**Step 3: Commit**

```bash
git add src/tools/index.ts
git commit -m "feat(skills): integrate load_skill tool into tool registry"
```

---

### Task 7: Add reloadSkills to Agent

**Files:**
- Modify: `src/agent/agent.ts`

**Step 1: Store basePrompt and add reloadSkills method**

In the Agent class, add a `basePrompt` field and modify the constructor:

```typescript
// Add field alongside existing fields
private basePrompt: string;

// Constructor: store basePrompt separately
constructor(config: AgentConfig) {
  this.baseURL = config.baseURL.replace(/\/+$/, "");
  this.apiKey = config.apiKey;
  this.model = config.model ?? "gpt-4o";
  this.maxTokens = config.maxTokens ?? 4096;
  this.basePrompt = config.systemPrompt;
  this.skills = config.skills;
  this.systemPrompt = this.buildSystemPrompt(config.systemPrompt, config.skills);
  for (const tool of config.tools) {
    this.tools.set(tool.name, tool);
  }
}
```

Add the public `reloadSkills` method after the `reset()` method:

```typescript
/** Reload skills and rebuild system prompt. */
reloadSkills(skills: Skill[]): void {
  this.skills = skills;
  this.systemPrompt = this.buildSystemPrompt(this.basePrompt, skills);
}
```

Add a public `getSkills` getter:

```typescript
/** Get current skills list (for load_skill tool). */
getSkills(): Skill[] {
  return this.skills;
}
```

**Step 2: Verify compile**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/agent/agent.ts
git commit -m "feat(skills): add reloadSkills and getSkills to Agent"
```

---

### Task 8: Update app/index.tsx Integration

**Files:**
- Modify: `app/index.tsx:30,75-102`

**Step 1: Update imports**

Add `skillStore` import:
```typescript
import { skillStore } from "../src/agent/skill-store";
```

**Step 2: Update initAgent to merge bundled + user skills**

Replace the skill loading block (lines 92-99) and tool creation (line 101):

```typescript
      // Load bundled skills
      const bundledSkills = loadSkills({
        "hiking-guide": hikingGuide,
        "photo-explainer": photoExplainer,
        "location-narrator": locationNarrator,
        "safety-advisor": safetyAdvisor,
        "trail-navigator": trailNavigator,
        "amap-lbs": amapLbs,
      });

      // Load user skills from storage
      const userSkills = await skillStore.load();

      // Merge: user skills override bundled skills with same name
      const skillMap = new Map<string, Skill>();
      for (const s of bundledSkills) skillMap.set(s.name, s);
      for (const s of userSkills) skillMap.set(s.name, s);
      const allSkills = Array.from(skillMap.values());

      const tools = createHikingTools(() => agentRef.current?.getSkills() ?? allSkills);
      const agent = new Agent({ apiKey, baseURL, model, systemPrompt: SYSTEM_PROMPT, tools, skills: allSkills });
```

Note: The `getSkills` getter is used via `agentRef.current?.getSkills()` so the load_skill tool always sees the latest skills after any reload.

**Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: Clean compile with no errors.

**Step 4: Commit**

```bash
git add app/index.tsx
git commit -m "feat(skills): integrate progressive disclosure skill loading in app"
```

---

### Task 9: Smoke Test

**Step 1: Start the dev server**

Run: `npx expo start`
Expected: No startup errors.

**Step 2: Manual test flow**

1. Open the app in Expo Go
2. Send a message like "你好" — agent should respond normally
3. Check that the agent can use tools (e.g., "附近有什么" triggers search_nearby)
4. Check that `load_skill` appears as an available tool in the API request (optional: add console.log in buildRequestBody)
5. Verify token usage is reduced (system prompt is now shorter without full skill content)

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(skills): address smoke test findings"
```
