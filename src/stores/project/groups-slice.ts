import {
  addGroup,
  addGroupWithLines,
  groupRepeatingSections,
  removeGroup,
  shareGroupTiming,
  updateGroup,
} from "@/domain/commands/group-edits";
import {
  addInstance,
  detachLine,
  placeInstance,
  removeInstance,
  setInstanceOwnTiming,
  shiftInstance,
} from "@/domain/commands/instance-edits";
import { isRefused } from "@/domain/commands/outcome";
import { NOTHING_SHARED } from "@/domain/group/group-plans";
import type { SharingOutcome } from "@/domain/group/shared-placement";
import type { GroupActions, GroupsState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createGroupsInitialState(): GroupsState {
  return {
    groups: [],
  };
}

// -- Slice --------------------------------------------------------------------

const createGroupsSlice: StateCreator<ProjectStore, [], [], GroupsState & GroupActions> = (set, get) => ({
  ...createGroupsInitialState(),

  setGroups: (groups) => set({ groups: Array.isArray(groups) ? groups : [], isDirty: true, isDirtySinceHistory: true }),

  addGroup: (group) => {
    get().commit(addGroup(group));
  },

  addGroupWithLines: (group, lines) => {
    get().commit(addGroupWithLines(group, lines));
  },

  groupRepeatingSections: (starts, length, options = {}) => {
    const sections = { starts, length, ...options };
    let sharing: SharingOutcome = NOTHING_SHARED;
    get().commit(groupRepeatingSections(sections, (planned) => (sharing = planned)));
    return sharing;
  },

  updateGroup: (id, updates) => {
    get().commit(updateGroup(id, updates));
  },

  removeGroup: (id) => {
    get().commit(removeGroup(id));
  },

  addInstance: (groupId, structure, instanceStart, insertAtIndex) => {
    get().commit(addInstance(groupId, structure, instanceStart, insertAtIndex));
  },

  removeInstance: (groupId, instanceIdx) => {
    get().commit(removeInstance(groupId, instanceIdx));
  },

  detachLine: (lineId) => {
    get().commit(detachLine(lineId));
  },

  shiftInstance: (groupId, instanceIdx, deltaSeconds, duration) => {
    get().commit(shiftInstance(groupId, instanceIdx, deltaSeconds, duration));
  },

  setInstanceOwnTiming: (groupId, instanceIdx, own, duration) => {
    const outcome = get().commit(setInstanceOwnTiming(groupId, instanceIdx, own, duration));
    return isRefused(outcome) && outcome.refused.reason === "realign" ? outcome.refused.refusal : null;
  },

  shareGroupTiming: (groupId, duration) => {
    let sharing: SharingOutcome = NOTHING_SHARED;
    get().commit(shareGroupTiming(groupId, duration, (planned) => (sharing = planned)));
    return sharing;
  },

  placeInstance: (groupId, instanceIdx, start, duration, precedingUpdates = []) =>
    !isRefused(get().commit(placeInstance(groupId, instanceIdx, start, duration, precedingUpdates))),
});

// -- Exports ------------------------------------------------------------------

export { createGroupsSlice, createGroupsInitialState };
