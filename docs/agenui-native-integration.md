# AGenUI Native Integration

This project treats AGenUI as the official Android native runtime, not a React Native reimplementation.

## Android SDK Artifact

Build the official SDK from https://github.com/AGenUI/AGenUI:

```bash
./scripts/android/build.sh
```

Then place the generated AAR here:

```text
android/app/libs/AGenUI-Client-Android-release.aar
```

The app module packages the AAR, and the Expo bridge compiles against the same official classes:

- `com.amap.agenui.AGenUI`
- `com.amap.agenui.render.surface.SurfaceManager`
- `com.amap.agenui.render.surface.ISurfaceManagerListener`
- `com.amap.agenui.render.surface.Surface`

`MainApplication` initializes `AGenUI` during `Application.onCreate()`, matching the official Android usage guide. `expo-agenui` creates one `SurfaceManager` per native view, attaches `Surface.getContainer()` to the React Native bubble, and feeds official A2UI stream messages to the SDK.

## Runtime Flow

1. The agent emits an `agenui` fenced block.
2. `AGenUIBubble` parses the payload.
3. `AGenUIView` feeds it into native `SurfaceManager.beginTextStream()`, `receiveTextChunk()`, and `endTextStream()`.
4. Native `Surface` containers are attached inside the React Native bubble.
5. Native action events come back through `onAction` and are routed to URL opening or the agent.

The catalog ID used by prompts and runtime defaults is `urn:a2ui:catalog:agenui_catalog`, which matches the official AGenUI catalog instead of the generic A2UI basic catalog.
