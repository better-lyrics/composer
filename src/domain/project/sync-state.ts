import { hasAnyTiming, isWordSynced } from "@/domain/line/predicates";
import type { SyncType } from "@/domain/lyrics-search/sync-type";
import type { LibraryProject } from "@/domain/project/library-project";

// -- Types --------------------------------------------------------------------

type SyncState = "synced" | "partial" | "empty";

// -- Public -------------------------------------------------------------------

function syncStateOf(project: LibraryProject): SyncState {
  const lines = project.lines;
  if (lines.length === 0) return "empty";
  const synced = lines.filter(hasAnyTiming).length;
  if (synced === 0) return "empty";
  if (synced === lines.length) return "synced";
  return "partial";
}

function syncTypeOf(project: LibraryProject): SyncType {
  const lines = project.lines;
  if (lines.length === 0) return "unsynced";
  if (lines.some((line) => line.words?.some((w) => w.syllableGroupId !== undefined))) return "syllable";
  if (lines.some(isWordSynced)) return "word";
  if (lines.some(hasAnyTiming)) return "line";
  return "unsynced";
}

// -- Exports ------------------------------------------------------------------

export { syncStateOf, syncTypeOf };
export type { SyncState };
