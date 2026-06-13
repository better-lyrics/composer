import type { LibraryProject } from "@/domain/project/library-project";
import type { AudioBlobStore } from "@/lib/audio-blob-store";
import { listLibraryProjects, putLibraryProject } from "@/lib/library-persistence";
import { clearCurrentProject, loadAudioFile, loadCurrentProject } from "@/lib/persistence";
import { applyPrimingShiftIfNeeded } from "@/lib/priming-migration";
import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS } from "@/stores/project/types";

// -- Types --------------------------------------------------------------------

interface MigrationDeps {
  audioBlobs: AudioBlobStore;
}

interface MigrationResult {
  migratedId?: string;
}

// -- Migration ----------------------------------------------------------------

async function migrateSingleSlotToLibrary(deps: MigrationDeps): Promise<MigrationResult> {
  const existing = await listLibraryProjects();
  if (existing.length > 0) {
    return { migratedId: existing[0].id };
  }

  const old = await loadCurrentProject();
  if (!old) {
    return {};
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  const oldAudio = await loadAudioFile();
  let audioBytesCached = false;
  let audioBytes: ArrayBuffer | undefined;
  if (oldAudio) {
    audioBytes = await oldAudio.arrayBuffer();
    await deps.audioBlobs.put(id, audioBytes);
    audioBytesCached = true;
  }

  const shifted = applyPrimingShiftIfNeeded(old.lines ?? [], audioBytes, old.primingStripped);

  const project: LibraryProject = {
    version: 1,
    id,
    metadata: old.metadata,
    agents: old.agents ?? [],
    lines: shifted.lines,
    groups: old.groups ?? [],
    granularity: old.granularity ?? "line",
    syllableSplitDefaults: old.syllableSplitDefaults ?? DEFAULT_SYLLABLE_SPLIT_DEFAULTS,
    audioSource: old.audioSource,
    audioBytesCached,
    dismissedSuggestions: old.dismissedSuggestions ?? [],
    dismissedExplicitSuggestions: old.dismissedExplicitSuggestions ?? [],
    currentStem: old.currentStem ?? "original",
    primingStripped: shifted.primingStripped,
    createdAt: old.savedAt ?? now,
    updatedAt: now,
    lastOpenedAt: now,
  };

  await putLibraryProject(project);
  await clearCurrentProject();

  return { migratedId: id };
}

// -- Exports ------------------------------------------------------------------

export { migrateSingleSlotToLibrary };
export type { MigrationDeps, MigrationResult };
