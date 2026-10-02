import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Fixtures -----------------------------------------------------------------

function indexEntry(id: string, overrides: Partial<ProjectIndexEntry> = {}): ProjectIndexEntry {
  return {
    id,
    title: id,
    artists: [],
    album: "",
    lineCount: 0,
    syncedLineCount: 0,
    hasWordTiming: false,
    audioKind: "none",
    storedAudioBytes: 0,
    updatedAt: 1,
    ...overrides,
  };
}

function countingIndexEntry(
  id: string,
  overrides: Partial<ProjectIndexEntry>,
  onTitleRead: () => void,
): ProjectIndexEntry {
  const base = indexEntry(id, overrides);
  return {
    ...base,
    get title() {
      onTitleRead();
      return base.title;
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { indexEntry, countingIndexEntry };
