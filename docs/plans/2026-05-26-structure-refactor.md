# Structure Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the project structure easier to maintain by cleaning generated artifacts, splitting oversized runtime/page files, and introducing feature-oriented boundaries.

**Architecture:** Keep Expo Router pages as route shells. Move chat and file-browser behavior into feature modules. Keep `src/agent/Agent` as the public facade while extracting transport, streaming, and tool execution helpers.

**Tech Stack:** Expo Router, React Native, TypeScript, local Expo modules.

### Task 1: Repository Hygiene

**Files:**
- Modify: `.gitignore`
- Inspect git index for build and generated artifacts.
- Remove generated binaries from git tracking without deleting local files.

**Verification:**
- Run `git status --short`.
- Run `npx tsc --noEmit` or local `tsc.cmd --noEmit`.

### Task 2: Agent Runtime Decomposition

**Files:**
- Create: `src/agent/openai-types.ts`
- Create: `src/agent/sse.ts`
- Create: `src/agent/tool-runner.ts`
- Modify: `src/agent/agent.ts`

**Goal:** Leave `Agent` responsible for orchestration only. Move SSE fallback parsing, OpenAI chunk types, and tool execution into focused modules.

**Verification:**
- Existing behavior compiles unchanged.
- `Agent` public API remains stable.

### Task 3: Chat Feature Extraction

**Files:**
- Create: `src/features/chat/buildSystemPrompt.ts`
- Create: `src/features/chat/useChatAgent.ts`
- Modify: `app/index.tsx`

**Goal:** Keep `app/index.tsx` as a route/UI shell. Move Agent initialization, skill loading, message subscription, send/photo/location/POI actions into a hook.

**Verification:**
- Route imports compile.
- Chat page still receives the same props/state it previously owned.

### Task 4: Files Feature Extraction

**Files:**
- Create: `src/features/files/useFileBrowser.ts`
- Modify: `app/files.tsx`

**Goal:** Move VFS state transitions and mutation actions out of the route file, leaving rendering and layout in the route.

**Verification:**
- File create, rename, delete, edit state is exposed through the hook.

### Task 5: Feature Boundary Cleanup

**Files:**
- Create or update feature barrel files where useful.
- Update imports to prefer feature modules for page-level logic.

**Verification:**
- Run TypeScript check.
- Review `git diff --stat` for scoped changes.
