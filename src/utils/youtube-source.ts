import type { AudioSource } from "@/stores/audio";

// -- Types --------------------------------------------------------------------

type YouTubeAudioSource = Extract<AudioSource, { type: "youtube" }>;

// -- Predicates ---------------------------------------------------------------

function isYouTubeSourceFor(source: AudioSource, videoId: string): source is YouTubeAudioSource {
  return source?.type === "youtube" && source.videoId === videoId;
}

function hasLoadedYouTubeSourceFor(source: AudioSource, videoId: string): boolean {
  return isYouTubeSourceFor(source, videoId) && source.file != null;
}

// -- Exports ------------------------------------------------------------------

export { isYouTubeSourceFor, hasLoadedYouTubeSourceFor };
