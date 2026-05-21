# 徒步搭子

徒步搭子是一个 Expo / React Native 移动应用，用聊天式 AI 向导陪伴用户徒步旅行。应用支持位置感知讲解、附近兴趣点搜索、天气查询、路线规划、拍照讲解、语音播报，以及可编辑的 Agent persona 和 Skill 系统。

## 功能概览

- AI 徒步向导：基于 OpenAI-compatible Chat Completions API，支持流式回复和工具调用。
- 位置与地图：获取当前位置、逆地理编码、附近 POI 搜索、地图展示。
- 高德 LBS：附近搜索、步行/驾车/骑行/公交路线规划、旅行行程规划。
- 拍照讲解：用户可拍照发送给模型，由视觉模型识别并讲解。
- Skill 系统：内置多套徒步、位置讲解、安全建议、拍照讲解等技能，可在应用内启用、禁用、编辑和新增。
- 个性化 Agent：可配置 Agent 名称、对用户称呼和性格描述。

## 技术栈

- Expo 53
- React 19
- React Native 0.79
- Expo Router
- TypeScript
- AsyncStorage / SecureStore
- 本地 Expo Modules：
  - `modules/expo-amap-location`
  - `modules/expo-amap-view`

## 目录结构

```text
app/                         Expo Router 页面
  index.tsx                  主聊天页
  settings.tsx               API 和地图 Key 配置
  agent-config.tsx           Agent persona 和 Skill 管理
  skill-edit.tsx             Skill 编辑器

src/agent/                   Agent 核心、消息类型、Skill 加载
src/tools/                   Agent 可调用工具
src/services/                地图、定位、天气、TTS、相机服务
src/components/              聊天、地图、输入框等组件
src/skills/                  内置 Skill.md 源文件和生成后的 index.ts
modules/                     自定义 Expo 原生模块
scripts/                     项目脚本
docs/plans/                  实施计划和设计文档
```

## 环境要求

- Node.js 18+
- npm
- Android Studio / Android SDK（运行 Android development build 时需要）
- Expo CLI（可通过 `npx expo ...` 调用）

由于项目包含自定义原生模块，Android 端定位和高德地图能力需要 development build。普通 Expo Go 不能加载这些本地模块。

## 安装依赖

```bash
npm install
```

## 常用命令

```bash
# 启动 Metro
npm run start

# Web 调试
npm run web

# Android development build
npm run android

# iOS development build
npm run ios

# 重新生成 src/skills/index.ts
npm run generate-skills
```

Windows PowerShell 可能会因为执行策略拒绝 `npx.ps1`。这种情况下可以直接调用本地命令：

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

## 应用配置

首次使用需要在应用内进入“设置”页面配置：

- API Key：LLM 服务密钥，必填。
- Base URL：OpenAI-compatible API 地址，默认可配置为 OpenAI 或兼容服务。
- 模型：当前默认模型来自应用配置。
- 高德地图 Key：可选，但地图、逆地理编码、附近搜索和路线规划需要它才能完整工作。

敏感配置在原生端通过 `expo-secure-store` 保存，在 Web 端通过 `localStorage` 保存。

## Agent 和 Skill 工作方式

`src/agent/agent.ts` 实现了一个简化的 Agent runtime：

- 构建 system prompt。
- 发送 Chat Completions 请求。
- 解析 SSE 流式响应。
- 收集并执行 tool calls。
- 将 tool result 写回对话，再继续下一轮模型调用。

内置 Skill 源文件位于 `src/skills/*/SKILL.md`。运行 `npm run generate-skills` 后会生成 `src/skills/index.ts`，移动端运行时直接读取静态字符串。

应用内的 Agent 配置页支持：

- 修改 Agent 名称、称呼和性格。
- 启用或禁用内置 Skill。
- 编辑内置 Skill，保存为用户覆盖版本。
- 新增或删除自定义 Skill。

配置保存后通常需要重新进入对话或重启应用才会完全生效。

## 地图和定位说明

Android 定位优先使用 `modules/expo-amap-location` 中的原生 `LocationManager` 实现，避免依赖 Google Play Services。坐标会在中国境内从 WGS-84 转为 GCJ-02，以匹配高德地图坐标系。

地图展示由 `modules/expo-amap-view` 提供原生高德 MapView。Web 端使用高德静态地图作为降级展示。

## Git 维护约定

以下内容不应进入版本控制：

- `node_modules/`
- `.expo/`
- `dist/`
- `web-build/`
- `build_log*.txt`
- 根目录 `android/`
- `modules/**/android/build/`

如果这些文件已经被跟踪，只需要从索引移除，保留本地文件：

```bash
git rm -r --cached node_modules dist .expo build_log.txt
```

## 验证

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

当前项目没有单元测试脚本，主要的自动验证是 TypeScript 类型检查。
