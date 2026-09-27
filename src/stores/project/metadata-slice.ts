import { withDefaultAgentNames } from "@/domain/agent/default-names";
import { agentsAfterImport } from "@/domain/agent/imported-agents";
import { importedKeysAfterWrite, metadataAfterImport } from "@/domain/project/imported-metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { createAgentsInitialState } from "@/stores/project/agents-slice";
import { createDismissalsInitialState } from "@/stores/project/dismissals-slice";
import { createGroupsInitialState } from "@/stores/project/groups-slice";
import { commitHistory } from "@/stores/project/history-helpers";
import { createHistoryInitialState } from "@/stores/project/history-slice";
import { createLinesInitialState } from "@/stores/project/lines-slice";
import { createSnapPointsInitialState } from "@/stores/project/snap-points-slice";
import type { MetadataActions, MetadataState, ProjectState, ProjectStore } from "@/stores/project/types";
import { createUiInitialState } from "@/stores/project/ui-slice";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createMetadataInitialState(): MetadataState {
  return {
    projectSession: 0,
    metadata: {
      title: "",
      artists: [],
      album: "",
      duration: 0,
    },
    hasUnexportedImport: false,
    importedMetadataKeys: [],
    ttmlEditState: null,
  };
}

function createProjectInitialState(): ProjectState {
  return {
    ...createMetadataInitialState(),
    ...createAgentsInitialState(),
    ...createLinesInitialState(),
    ...createGroupsInitialState(),
    ...createUiInitialState(),
    ...createDismissalsInitialState(),
    ...createSnapPointsInitialState(),
    ...createHistoryInitialState(),
  };
}

// -- Slice --------------------------------------------------------------------

const createMetadataSlice: StateCreator<ProjectStore, [], [], MetadataState & MetadataActions> = (set) => ({
  ...createMetadataInitialState(),

  setMetadata: (metadata) =>
    set((state) => ({
      metadata: { ...state.metadata, ...metadata },
      importedMetadataKeys: importedKeysAfterWrite(state.importedMetadataKeys, metadata),
      isDirty: true,
    })),

  startProjectSession: () => set((state) => ({ projectSession: state.projectSession + 1 })),

  reset: () => set((state) => ({ ...createProjectInitialState(), projectSession: state.projectSession + 1 })),
  resetSongIdentity: (title) =>
    set((state) => ({
      metadata: normalizeLoadedMetadata({ title }),
      agents: withDefaultAgentNames(state.agents),
      hasUnexportedImport: false,
      importedMetadataKeys: [],
      isDirty: true,
      isDirtySinceHistory: true,
    })),

  restoreSongIdentity: (identity) => set({ ...identity, isDirty: true, isDirtySinceHistory: true }),

  replaceLyricsWithHistory: ({ lines, groups, agents, metadata }) =>
    set((state) => {
      const importsSongDetails = Object.keys(metadata).length > 0 || (agents?.length ?? 0) > 0;
      const next = metadataAfterImport(state.metadata, state.importedMetadataKeys, metadata);
      const assignment = agentsAfterImport(state.agents, agents, lines);
      return {
        ...commitHistory(state, { lines: assignment.lines, groups, agents: assignment.agents }),
        metadata: next.metadata,
        importedMetadataKeys: next.importedKeys,
        hasUnexportedImport: importsSongDetails || state.hasUnexportedImport,
        ttmlEditState: null,
      };
    }),

  markSongDetailsImported: () => set({ hasUnexportedImport: true, isDirty: true }),

  restoreImportedMetadataKeys: (keys) => set({ importedMetadataKeys: keys }),

  clearUnexportedImport: () =>
    set((state) => (state.hasUnexportedImport ? { hasUnexportedImport: false, isDirty: true } : state)),

  setTtmlEditState: (editState) =>
    set((state) => {
      const next = typeof editState === "function" ? editState(state.ttmlEditState) : editState;
      return next === state.ttmlEditState ? state : { ttmlEditState: next, isDirty: true };
    }),
});

// -- Exports ------------------------------------------------------------------

export { createMetadataSlice, createProjectInitialState };
