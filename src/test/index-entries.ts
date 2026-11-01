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

// -- Exports ------------------------------------------------------------------

export { indexEntry };
