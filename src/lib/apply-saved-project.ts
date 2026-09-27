import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { isMetadataKey } from "@/domain/project/imported-metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import type { SavedProject } from "@/lib/persistence";
import { useProjectStore } from "@/stores/project";
import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS } from "@/stores/project/types";
import { useSettingsStore } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

type SavedProjectOrigin = "storage" | "file";

// -- Helpers ------------------------------------------------------------------

function malformedFieldsOf(project: SavedProject): string[] {
  const issues: string[] = [];
  if (!project.lines) issues.push("missing lines");
  if (!project.agents || project.agents.length === 0) issues.push("missing or empty agents");
  if (project.granularity === undefined) issues.push("missing granularity");
  return issues;
}

// -- Public API ---------------------------------------------------------------

function applySavedProject(project: SavedProject, origin: SavedProjectOrigin): string[] {
  const state = useProjectStore.getState();
  state.setMetadata(normalizeLoadedMetadata(project.metadata));
  state.setLines(project.lines ?? []);
  state.setGroups(project.groups ?? []);
  state.setGranularity(project.granularity ?? useSettingsStore.getState().defaultGranularity);
  state.setSyllableSplitDefaults(project.syllableSplitDefaults ?? DEFAULT_SYLLABLE_SPLIT_DEFAULTS);
  state.setAgents(project.agents && project.agents.length > 0 ? project.agents : DEFAULT_AGENTS);
  state.setDismissedSuggestions(project.dismissedSuggestions ?? []);
  state.setDismissedExplicitSuggestions(project.dismissedExplicitSuggestions ?? []);
  // The flag describes stored timings against the stored audio, which a project file does not carry.
  if (origin === "storage") state.setPrimingStripped(project.primingStripped ?? false);
  state.setCustomSnapPoints(project.customSnapPoints ?? []);
  if (origin === "file" || project.hasUnexportedImport) state.markSongDetailsImported();
  state.restoreImportedMetadataKeys((project.importedMetadataKeys ?? []).filter(isMetadataKey));
  state.setTtmlEditState(project.ttmlEditState ?? null);
  if (origin === "file") state.clearHistory();
  state.markClean();
  return malformedFieldsOf(project);
}

// -- Exports ------------------------------------------------------------------

export { applySavedProject };
