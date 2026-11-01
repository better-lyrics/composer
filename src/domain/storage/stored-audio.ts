import { compareIds } from "@/domain/project/id-order";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Types --------------------------------------------------------------------

type AudioFilter = "all" | "local" | "youtube";
type AudioFields = Pick<ProjectIndexEntry, "audioKind" | "storedAudioBytes">;
type StoredAudioEntry = Pick<ProjectIndexEntry, "id" | "title" | "audioKind" | "storedAudioBytes">;

// -- Predicates ---------------------------------------------------------------

function isCachedYouTubeAudio(entry: AudioFields): boolean {
  return entry.audioKind === "youtube" && entry.storedAudioBytes > 0;
}

function matchesAudioFilter(entry: AudioFields, filter: AudioFilter): boolean {
  if (filter === "all") return true;
  return filter === "youtube" ? entry.audioKind === "youtube" : entry.audioKind !== "youtube";
}

// -- Derivations --------------------------------------------------------------

function storedAudioProjects<T extends StoredAudioEntry>(entries: readonly T[], filter: AudioFilter): T[] {
  return entries
    .filter((entry) => entry.storedAudioBytes > 0 && matchesAudioFilter(entry, filter))
    .toSorted(
      (a, b) => b.storedAudioBytes - a.storedAudioBytes || a.title.localeCompare(b.title) || compareIds(a.id, b.id),
    );
}

function hasStoredYouTubeAudio(entries: readonly AudioFields[]): boolean {
  return entries.some(isCachedYouTubeAudio);
}

function hasClearableYouTubeAudio(
  entries: readonly (AudioFields & Pick<ProjectIndexEntry, "id">)[],
  isProjectInUse: (id: string) => boolean,
): boolean {
  return entries.some((entry) => isCachedYouTubeAudio(entry) && !isProjectInUse(entry.id));
}

// -- Exports ------------------------------------------------------------------

export { isCachedYouTubeAudio, storedAudioProjects, hasStoredYouTubeAudio, hasClearableYouTubeAudio };
export type { AudioFilter };
