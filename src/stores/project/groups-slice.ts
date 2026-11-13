import { addGroup } from "@/domain/commands/group-edits";
import type { GroupActions, GroupsState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createGroupsInitialState(): GroupsState {
  return {
    groups: [],
  };
}

// -- Slice --------------------------------------------------------------------

const createGroupsSlice: StateCreator<ProjectStore, [], [], GroupsState & GroupActions> = (_set, get) => ({
  ...createGroupsInitialState(),

  addGroup: (group) => {
    get().commit(addGroup(group));
  },
});

// -- Exports ------------------------------------------------------------------

export { createGroupsSlice, createGroupsInitialState };
