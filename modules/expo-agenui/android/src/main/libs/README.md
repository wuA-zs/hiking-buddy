The Expo module does not depend on the official AGenUI AAR directly because Android Gradle Plugin does not allow a library module to bundle another local AAR safely.

Place the official Android AGenUI AAR in the app module instead:

```text
android/app/libs/AGenUI-Client-Android-release.aar
```

Expected source artifact name:

```text
AGenUI-Client-Android-release.aar
```

Build it from the official AGenUI repository with:

```bash
./scripts/android/build.sh
```
