# Release Build Notes

These notes capture repeatable build lessons from the Android release build on
2026-05-21. They are meant to prevent future builds from losing time on the
same environment issues.

## Recommended Release Flow

Run TypeScript validation first:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

Build the signed Android release APK from the Android project:

```powershell
cd android
.\gradlew.bat :app:assembleRelease --rerun-tasks --console=plain
```

The release artifact is written to:

```text
android/app/build/outputs/apk/release/app-release.apk
```

If a root-level distributable is needed, copy it to:

```text
hiking-buddy-release.apk
```

## Known Build Pitfalls

- In the Codex sandbox, Gradle can report exit code `1` even when the Gradle
  daemon log says the build action returned `Success`. The symptom is very
  short output, often stopping around daemon startup, with no real Gradle
  failure message.
- If the APK timestamp does not change after a build attempt, do not trust the
  existing artifact. Re-run with `--rerun-tasks` and verify the timestamp on
  `android/app/build/outputs/apk/release/app-release.apk`.
- If even a read-only Gradle command such as `.\gradlew.bat -q projects` exits
  with no useful output in the sandbox, run the release build outside the
  sandbox/with approval instead of debugging app code.
- Gradle may print warnings from dependencies about deprecated APIs,
  AndroidManifest `package` attributes, or Expo/RN internals. These are not
  release blockers unless Gradle ends with `BUILD FAILED`.
- `llvm-strip` may fail to strip `libAMapSDK_MAP_v6_8_0.so`; Gradle packages it
  as-is and can still finish with `BUILD SUCCESSFUL`.
- The Expo bundler can warn that `NODE_ENV` is not specified and then continue
  using `.env.local`/`.env`. This warning did not block the successful release
  build.

## Speeding Up Local Builds

- Do not use `--rerun-tasks` for everyday builds. It forces nearly every Gradle
  task to run again. Keep it for final fresh-release verification.
- For an incremental release build, prefer:

```powershell
cd android
.\gradlew.bat :app:assembleRelease --console=plain
```

- For fast local Android release validation on a modern physical device, build
  only `arm64-v8a`:

```powershell
cd android
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
```

- Keep Gradle, Android, and Metro caches when possible. Deleting `.gradle`,
  `android/app/build`, or Metro cache turns the next build into a much slower
  cold build.
- Use `assembleDebug` or `npm run android` for development checks. Release
  builds run extra work such as R8 minification, resource shrinking, signing,
  native symbol handling, and APK optimization.
- Treat build types differently:
  - quick type check: `.\node_modules\.bin\tsc.cmd --noEmit`
  - quick native/dev validation: `cd android` then
    `.\gradlew.bat :app:assembleDebug --console=plain`
  - faster local release check: release with
    `-PreactNativeArchitectures=arm64-v8a`
  - final distributable: full `:app:assembleRelease`, optionally with
    `--rerun-tasks` when a completely fresh artifact is required

## Verification Checklist

- `tsc --noEmit` exits successfully.
- Gradle output ends with `BUILD SUCCESSFUL`.
- `android/app/build/outputs/apk/release/output-metadata.json` shows:
  - `applicationId`: `com.hikingbuddy.app`
  - `variantName`: `release`
  - `versionName`: current app version
  - `outputFile`: `app-release.apk`
- The APK timestamp and size changed after the build if a fresh release was
  expected.
