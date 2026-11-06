import type { SavedAudioSource } from "@/domain/project/audio-source";
import type { AudioSource } from "@/stores/audio";

// -- Functions ----------------------------------------------------------------

function toSavedAudioSource(source: AudioSource): SavedAudioSource | undefined {
  if (!source) return undefined;
  if (source.type === "file") return { kind: "file", name: source.file.name };
  if (source.type === "youtube") return { kind: "youtube", videoId: source.videoId, details: source.details };
  return undefined;
}

// The open project's audio, falling back to the audio it expects while that is not loaded.
function projectAudioSource(state: {
  source: AudioSource;
  expectedAudio: SavedAudioSource | null;
}): SavedAudioSource | undefined {
  return toSavedAudioSource(state.source) ?? state.expectedAudio ?? undefined;
}

// -- Exports ------------------------------------------------------------------

export { projectAudioSource };
