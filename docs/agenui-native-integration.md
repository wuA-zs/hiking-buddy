# AGenUI Native Integration

This project now treats AGenUI as a native runtime, not a React Native reimplementation.

## Android SDK Artifact

Build the official SDK from https://github.com/AGenUI/AGenUI:

```bash
./scripts/android/build.sh
```

Then place the generated AAR here:

```text
modules/expo-agenui/android/src/main/libs/AGenUI-Client-Android-release.aar
```

The Expo bridge uses reflection against the official classes:

- `com.amap.agenui.AGenUI`
- `com.amap.agenui.render.surface.SurfaceManager`
- `com.amap.agenui.render.surface.ISurfaceManagerListener`
- `com.amap.agenui.render.surface.Surface`

This keeps the app buildable before the SDK artifact is copied in, while switching to the real native runtime as soon as the AAR is packaged.

## Runtime Flow

1. The agent emits an `agenui` fenced block.
2. `AGenUIBubble` parses the payload.
3. `AGenUIView` feeds it into native `SurfaceManager.beginTextStream()`, `receiveTextChunk()`, and `endTextStream()`.
4. Native `Surface` containers are attached inside the React Native bubble.
5. Native action events come back through `onAction` and are routed to URL opening or the agent.

If the native SDK is unavailable, the app falls back to the older React Native `A2UIRenderer` so development can continue.
