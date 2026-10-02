import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { fileExtensionLabel } from "@/utils/file-name";

// -- Types --------------------------------------------------------------------

type AudioStatusFields = Pick<ProjectIndexEntry, "audioKind" | "storedAudioBytes" | "audioFileName">;

type ProjectAudioStatus =
  | { kind: "none" }
  | { kind: "youtube" }
  | { kind: "file"; format: string; bytes: number }
  | { kind: "missing"; fileName?: string };

// -- Constants ----------------------------------------------------------------

const UNKNOWN_FORMAT = "File";

// -- Derivations --------------------------------------------------------------

function projectAudioStatus(entry: AudioStatusFields): ProjectAudioStatus {
  if (entry.audioKind === "youtube") return { kind: "youtube" };
  if (entry.audioKind === "none") return { kind: "none" };
  if (entry.storedAudioBytes <= 0) {
    return entry.audioFileName ? { kind: "missing", fileName: entry.audioFileName } : { kind: "missing" };
  }
  return {
    kind: "file",
    format: fileExtensionLabel(entry.audioFileName, UNKNOWN_FORMAT),
    bytes: entry.storedAudioBytes,
  };
}

function storedAudioBytesTotal(entries: readonly Pick<ProjectIndexEntry, "storedAudioBytes">[]): number {
  let total = 0;
  for (const entry of entries) total += entry.storedAudioBytes;
  return total;
}

// -- Exports ------------------------------------------------------------------

export { projectAudioStatus, storedAudioBytesTotal };
export type { AudioStatusFields };
