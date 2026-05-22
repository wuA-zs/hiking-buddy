# Agent 配置页面设计

## Context

当前系统提示和 skill 全部硬编码，用户无法自定义 agent 身份或管理 skills。需要新增独立配置页面，支持身份设置、skill 开关/编辑/新增。

## 数据模型

### AgentPersona（AsyncStorage key: `agent_persona`）

```typescript
interface AgentPersona {
  name: string;          // agent 自称，默认 "小Pi"
  userAddress: string;   // 对用户称呼，默认 "朋友"
  personality: string;   // 性格描述，默认 "热情、幽默、像朋友"
}
```

### Skill 禁用列表（AsyncStorage key: `disabled_skills`）

```typescript
// string[] — 存被禁用的 skill name
```

### 现有存储复用

- 用户修改内置 skill 内容 → `skillStore.save()` 覆盖（已有 user override bundled 机制）
- 新增自定义 skill → `skillStore.save()` 新增
- 删除自定义 skill → `skillStore.remove()`

## 路由与导航

```
app/
  _layout.tsx         ← Stack 加 agent-config（modal）、skill-edit（push）
  index.tsx           ← header 右侧加 agent-config 入口图标
  agent-config.tsx    ← Agent 配置页（身份 + skill 列表）
  skill-edit.tsx      ← Skill 编辑页（stack push，参数: skillName）
```

### 导航流程

- 首页 header 右侧：面具图标（→ agent-config）+ 齿轮图标（→ settings）
- agent-config → 点击某个 skill → stack push skill-edit?name=xxx
- agent-config → 点击"添加自定义 Skill" → stack push skill-edit（无参数，新建模式）

## 页面设计

### agent-config.tsx

顶部 gradient header，标题"Agent 配置"，下方三个 card：

**身份设置卡**
- 代理名称：TextInput，placeholder "小Pi"
- 对用户称呼：TextInput，placeholder "朋友"
- 性格描述：TextInput multiline，placeholder "热情、幽默、像朋友"
- 底部保存按钮

**Skills 列表卡**
- 每个 skill 一行：
  - Switch（启用/禁用）
  - skill name（粗体）
  - description 截断为一行
  - 右箭头 >（点击进入编辑）
- 列表底部："+ 添加自定义 Skill" 按钮

**关于卡**
- 显示当前 agent 配置摘要

### skill-edit.tsx

- header 显示 skill name（或"新建 Skill"）
- 名称输入（新建时可编辑，内置 skill 只读但显示）
- Markdown 内容编辑区（多行 TextInput，占满剩余空间）
- 底部操作栏：
  - 保存按钮（通用）
  - "重置为默认"按钮（仅内置 skill 且被修改过时显示）
  - "删除"按钮（仅自定义 skill）

## 动态系统提示

SYSTEM_PROMPT 从硬编码常量改为函数，接收 persona 参数：

```typescript
function buildBasePrompt(persona: AgentPersona): string {
  return `你是一个手机徒步搭子应用的核心 AI 向导"${persona.name}"。
...
你的性格：${persona.personality}。
称呼用户为"${persona.userAddress}"。
...`;
}
```

## 生效时机

- 修改配置后不立即重建 agent
- 下次启动 app 或手动重启对话时读取最新配置
- agent-config 页面保存后显示 Alert 提示"配置已保存，重启对话后生效"

## 涉及文件

| 文件 | 操作 |
|---|---|
| `app/_layout.tsx` | 添加 agent-config、skill-edit 路由 |
| `app/index.tsx` | header 加入口图标，SYSTEM_PROMPT 改为动态 |
| `app/agent-config.tsx` | 新建 |
| `app/skill-edit.tsx` | 新建 |
| `src/lib/config.ts` | 添加 persona 存取 + disabledSkills 存取 |
| `src/agent/agent.ts` | 支持动态 systemPrompt 重建 |
