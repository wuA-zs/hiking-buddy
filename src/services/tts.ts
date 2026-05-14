/**
 * TTS service — expo-speech wrapper
 */

import * as Speech from "expo-speech";

let isSpeaking = false;

export async function speak(text: string, language = "zh-CN"): Promise<void> {
  // Stop any ongoing speech before starting new one
  if (isSpeaking) {
    Speech.stop();
    isSpeaking = false;
  }

  return new Promise((resolve) => {
    isSpeaking = true;
    Speech.speak(text, {
      language,
      rate: 1.0,
      pitch: 1.0,
      onDone: () => {
        isSpeaking = false;
        resolve();
      },
      onStopped: () => {
        isSpeaking = false;
        resolve();
      },
      onError: () => {
        isSpeaking = false;
        resolve();
      },
    });
  });
}

export function stopSpeaking(): void {
  if (isSpeaking) {
    Speech.stop();
    isSpeaking = false;
  }
}

export function getIsSpeaking(): boolean {
  return isSpeaking;
}
