import { placeVoice } from "@/domain/line/place-voice";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";

// -- Operation ----------------------------------------------------------------

// Places one voice (main or background) at the current playhead time for a
// single line instance. This is a per-instance timing write: it must NOT
// propagate to linked siblings, or their backgrounds get cleared or re-resolved
// (regression vs the pre-voice-model path).
function placeVoiceAtPlayhead(lineId: string, voice: "main" | "background"): void {
  const line = useProjectStore.getState().lines.find((l) => l.id === lineId);
  if (!line) return;
  const currentTime = useAudioStore.getState().currentTime;
  const wordDuration = useSettingsStore.getState().defaultWordDuration;
  useProjectStore
    .getState()
    .setLineWithHistory(lineId, placeVoice(line, voice, currentTime, wordDuration), { propagateToSiblings: false });
}

// -- Exports ------------------------------------------------------------------

export { placeVoiceAtPlayhead };
