import type { ViewProps } from "react-native";

export interface AGenUIFunctionCall {
  call: string;
  args?: Record<string, unknown>;
}

export interface AGenUIEventAction {
  name: string;
  context?: Record<string, unknown>;
}

export interface AGenUIAction {
  functionCall?: AGenUIFunctionCall;
  event?: AGenUIEventAction;
}

export interface AGenUIActionEvent {
  surfaceId?: string;
  componentId?: string;
  rawEvent: string;
  action?: AGenUIAction;
}

export interface AGenUIErrorEvent {
  message: string;
  missingNativeSdk?: boolean;
}

export interface AGenUIViewProps extends ViewProps {
  payload: string;
  colorScheme?: "light" | "dark";
  onAction?: (event: { nativeEvent: AGenUIActionEvent }) => void;
  onError?: (event: { nativeEvent: AGenUIErrorEvent }) => void;
}
