import type { GroupsState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createGroupsInitialState(): GroupsState {
  return {
    groups: [],
  };
}

// -- Slice --------------------------------------------------------------------

const createGroupsSlice: StateCreator<ProjectStore, [], [], GroupsState> = () => ({
  ...createGroupsInitialState(),
});

// -- Exports ------------------------------------------------------------------

export { createGroupsSlice, createGroupsInitialState };
