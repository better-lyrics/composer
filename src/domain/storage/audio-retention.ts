// -- Constants ----------------------------------------------------------------

const KEEP_YOUTUBE_AUDIO_RULES = ["auto", "always", "never"] as const;

// -- Types --------------------------------------------------------------------

type KeepYouTubeAudio = (typeof KEEP_YOUTUBE_AUDIO_RULES)[number];

// -- Rules --------------------------------------------------------------------

function isKeepYouTubeAudio(value: unknown): value is KeepYouTubeAudio {
  return typeof value === "string" && (KEEP_YOUTUBE_AUDIO_RULES as readonly string[]).includes(value);
}

function keepsYouTubeAudio(rule: KeepYouTubeAudio, bridgeEnabled: boolean): boolean {
  if (rule === "always") return true;
  if (rule === "never") return false;
  return !bridgeEnabled;
}

// -- Exports ------------------------------------------------------------------

export { isKeepYouTubeAudio, keepsYouTubeAudio };
export type { KeepYouTubeAudio };
