import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="files" />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      <Stack.Screen name="agent-config" options={{ presentation: "modal" }} />
      <Stack.Screen name="skill-edit" />
    </Stack>
  );
}
