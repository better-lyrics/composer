import type { AudioSource } from "@/stores/audio";
import { fileIdentityKey } from "@/utils/file-identity";

// -- Functions ----------------------------------------------------------------

function songKey(source: AudioSource): string | null {
  if (source?.type === "file") return `file:${fileIdentityKey(source.file)}`;
  if (source?.type === "youtube") return `youtube:${source.videoId}`;
  return null;
}

// -- Exports ------------------------------------------------------------------

export { songKey };
