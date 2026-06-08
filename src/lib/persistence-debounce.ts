import type { Stem } from "@/audio/separation/types";
import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { type SavedAudioSource, saveCurrentProject } from "@/lib/persistence";
import type { GranularityMode } from "@/stores/project";
import type { SyllableSplitDefaults } from "@/stores/project/types";
import { useSettingsStore } from "@/stores/settings";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Persistence]";

// -- Module state -------------------------------------------------------------

type SaveArgs = [
  ProjectMetadata,
  Agent[],
  LyricLine[],
  LinkGroup[],
  GranularityMode,
  SyllableSplitDefaults,
  SavedAudioSource | undefined,
  string[],
  string[],
  Stem,
];

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSaveArgs: SaveArgs | null = null;

// -- Public API ---------------------------------------------------------------

function debouncedSave(
  metadata: ProjectMetadata,
  agents: Agent[],
  lines: LyricLine[],
  groups: LinkGroup[],
  granularity: GranularityMode,
  syllableSplitDefaults: SyllableSplitDefaults,
  audioSource: SavedAudioSource | undefined,
  dismissedSuggestions: string[],
  dismissedExplicitSuggestions: string[],
  currentStem: Stem,
): void {
  pendingSaveArgs = [
    metadata,
    agents,
    lines,
    groups,
    granularity,
    syllableSplitDefaults,
    audioSource,
    dismissedSuggestions,
    dismissedExplicitSuggestions,
    currentStem,
  ];
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  const saveDelay = useSettingsStore.getState().autoSaveDelay;
  saveTimeout = setTimeout(() => {
    if (pendingSaveArgs) {
      saveCurrentProject(...pendingSaveArgs).catch((err) => console.error(LOG_PREFIX, "Auto-save failed:", err));
      pendingSaveArgs = null;
    }
    saveTimeout = null;
  }, saveDelay);
}

function cancelPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingSaveArgs = null;
}

function flushPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (pendingSaveArgs) {
    saveCurrentProject(...pendingSaveArgs).catch((err) => console.error(LOG_PREFIX, "Flush save failed:", err));
    pendingSaveArgs = null;
  }
}

// Skip the debounce entirely and write to IDB now. Used for discrete user
// actions (stem selection) where the debounce buys nothing and an immediate
// reload would otherwise lose the save. Cancels any pending debounced save so
// the immediate write isn't shadowed by a stale queued one.
function saveProjectNow(
  metadata: ProjectMetadata,
  agents: Agent[],
  lines: LyricLine[],
  groups: LinkGroup[],
  granularity: GranularityMode,
  syllableSplitDefaults: SyllableSplitDefaults,
  audioSource: SavedAudioSource | undefined,
  dismissedSuggestions: string[],
  dismissedExplicitSuggestions: string[],
  currentStem: Stem,
): Promise<void> {
  cancelPendingSave();
  return saveCurrentProject(
    metadata,
    agents,
    lines,
    groups,
    granularity,
    syllableSplitDefaults,
    audioSource,
    dismissedSuggestions,
    dismissedExplicitSuggestions,
    currentStem,
  );
}

// -- Exports ------------------------------------------------------------------

export { debouncedSave, cancelPendingSave, flushPendingSave, saveProjectNow };
