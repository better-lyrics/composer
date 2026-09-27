import { withDefaultAgentNames } from "@/domain/agent/default-names";
import { agentsAfterImport } from "@/domain/agent/imported-agents";
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
      isDirty: true,
    })),

  startProjectSession: () => set((state) => ({ projectSession: state.projectSession + 1 })),

  reset: () => set((state) => ({ ...createProjectInitialState(), projectSession: state.projectSession + 1 })),
  resetSongIdentity: (title) =>
    set((state) => ({
      metadata: normalizeLoadedMetadata({ title }),
      agents: withDefaultAgentNames(state.agents),
      hasUnexportedImport: false,
      isDirty: true,
    })),

  restoreSongIdentity: (identity) => set({ ...identity, isDirty: true }),

  replaceLyricsWithHistory: ({ lines, groups, agents, metadata }) =>
    set((state) => {
      const { title, thumbnailDataUrl, thumbnailForVideoId } = state.metadata;
      const importsSongDetails = Object.keys(metadata).length > 0 || (agents?.length ?? 0) > 0;
      return {
        ...commitHistory(state, { lines, groups, agents: agentsAfterImport(state.agents, agents, lines) }),
        // A title from an earlier import belongs to that lyrics file, not to the loaded song.
        metadata: normalizeLoadedMetadata({
          title: state.hasUnexportedImport ? "" : title,
          thumbnailDataUrl,
          thumbnailForVideoId,
          ...metadata,
        }),
        hasUnexportedImport: importsSongDetails || state.hasUnexportedImport,
      };
    }),

  markSongDetailsImported: () => set({ hasUnexportedImport: true, isDirty: true }),

  clearUnexportedImport: () =>
    set((state) => (state.hasUnexportedImport ? { hasUnexportedImport: false, isDirty: true } : state)),
});

// -- Exports ------------------------------------------------------------------

export { createMetadataSlice, createProjectInitialState };
