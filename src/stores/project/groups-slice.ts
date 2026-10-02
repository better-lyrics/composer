import { initialGroupSharing } from "@/domain/group/initial-sharing";
import { unlinkLines } from "@/domain/group/linking";
import { withNewInstance, withOwnTiming } from "@/domain/group/own-timing";
import { placeSharedInstance, realignSharedInstance } from "@/domain/group/shared-placement";
import { wholeSongRange } from "@/domain/group/shared-timing";
import { offsetTemplateWords } from "@/domain/group/template";
import { nextInstanceIdx } from "@/domain/instance/enumerate";
import { belongsToInstance, isAttachedToInstance } from "@/domain/instance/predicates";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { clampShiftDelta, shiftLineTiming } from "@/domain/line/shift";
import { commitHistory, commitSharedTimingHistory } from "@/stores/project/history-helpers";
import type { GroupActions, GroupsState, ProjectStore } from "@/stores/project/types";
import { useSettingsStore } from "@/stores/settings";
import { GROUP_COLORS, pickNextGroupColor } from "@/utils/group-colors";
import { songEndOrUnbounded } from "@/utils/timing/song-end";
import type { StateCreator } from "zustand";

// -- Constants ----------------------------------------------------------------

const MIN_SHIFT_SECONDS = 0.001;

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

  addGroup: (group) => set((state) => commitHistory(state, { groups: [...state.groups, group] })),

  addGroupWithLines: (group, lines) =>
    set((state) => commitHistory(state, { groups: [...state.groups, group], lines })),

  groupRepeatingSections: (starts, length, options = {}) => {
    const state = get();
    if (starts.length < 2 || length < 1) return [];

    const covered = new Set<number>();
    for (const start of starts) {
      for (let p = start; p < start + length; p++) {
        if (p < 0 || p >= state.lines.length) return [];
        if (state.lines[p].groupId !== undefined) return [];
        if (covered.has(p)) return [];
        covered.add(p);
      }
    }

    const usedGroupIds = new Set(state.groups.map((g) => g.id));
    let n = 1;
    while (usedGroupIds.has(`g${n}`)) n++;
    const groupId = `g${n}`;

    const usedColors = state.groups.map((g) => g.color);
    const color = options.color ?? pickNextGroupColor(usedColors.length > 0 ? usedColors : GROUP_COLORS.slice(0, 0));
    const label = options.label ?? `Group ${state.groups.length + 1}`;

    const startToInstanceIdx = new Map<number, number>();
    const sortedStarts = starts.toSorted((a, b) => a - b);
    sortedStarts.forEach((s, i) => startToInstanceIdx.set(s, i));

    const updatedLines = state.lines.map((line, idx) => {
      for (const start of sortedStarts) {
        if (idx >= start && idx < start + length) {
          return {
            ...line,
            groupId,
            instanceIdx: startToInstanceIdx.get(start) ?? 0,
            templateLineIdx: idx - start,
          };
        }
      }
      return line;
    });

    const { group, lines, keptOwnTiming } = initialGroupSharing(
      updatedLines,
      { id: groupId, label, color, templateVersion: 1 },
      useSettingsStore.getState().shareTimingInNewGroups,
    );

    set(commitHistory(state, { groups: [...state.groups, group], lines }, { deriveText: false }));
    return keptOwnTiming;
  },

  updateGroup: (id, updates) =>
    set((state) =>
      commitHistory(state, {
        groups: state.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      }),
    ),

  removeGroup: (id) =>
    set((state) =>
      commitHistory(state, {
        groups: state.groups.filter((g) => g.id !== id),
        lines: unlinkLines(state.lines, (line) => line.groupId === id),
      }),
    ),

  addInstance: (groupId, structure, instanceStart, insertAtIndex) =>
    set((state) => {
      const instanceIdx = nextInstanceIdx(state.lines, groupId);

      const newLines: LyricLine[] = structure.map((tplLine, templateLineIdx) =>
        reconcileLine({
          id: crypto.randomUUID(),
          text: tplLine.text,
          agentId: tplLine.agentId,
          groupId,
          instanceIdx,
          templateLineIdx,
          ...(tplLine.relativeBegin !== undefined ? { begin: tplLine.relativeBegin + instanceStart } : {}),
          ...(tplLine.relativeEnd !== undefined ? { end: tplLine.relativeEnd + instanceStart } : {}),
          ...(tplLine.words
            ? {
                words: offsetTemplateWords(tplLine.words, instanceStart),
              }
            : {}),
          ...(tplLine.backgroundText !== undefined ? { backgroundText: tplLine.backgroundText } : {}),
          ...(tplLine.backgroundWords
            ? {
                backgroundWords: offsetTemplateWords(tplLine.backgroundWords, instanceStart),
              }
            : {}),
          ...(tplLine.backgroundTextSource !== undefined ? { backgroundTextSource: tplLine.backgroundTextSource } : {}),
          ...(tplLine.translations ? { translations: structuredClone(tplLine.translations) } : {}),
          ...(tplLine.transliteration ? { transliteration: structuredClone(tplLine.transliteration) } : {}),
        }),
      );

      const insertedLines =
        insertAtIndex === undefined || insertAtIndex >= state.lines.length || insertAtIndex < 0
          ? [...state.lines, ...newLines]
          : [...state.lines.slice(0, insertAtIndex), ...newLines, ...state.lines.slice(insertAtIndex)];

      return commitHistory(state, {
        lines: insertedLines,
        groups: withNewInstance(state.groups, groupId, instanceIdx),
      });
    }),

  removeInstance: (groupId, instanceIdx) =>
    set((state) => {
      const detachedLines = unlinkLines(state.lines, (line) => belongsToInstance(line, groupId, instanceIdx));

      const remainingInGroup = detachedLines.some((l) => l.groupId === groupId);
      const nextGroups = remainingInGroup ? state.groups : state.groups.filter((g) => g.id !== groupId);

      return commitHistory(state, { lines: detachedLines, groups: nextGroups });
    }),

  detachLine: (lineId) =>
    set((state) =>
      commitHistory(state, {
        lines: unlinkLines(state.lines, (line) => line.id === lineId),
      }),
    ),

  shiftInstance: (groupId, instanceIdx, deltaSeconds, duration) =>
    set((state) => {
      const isMember = (line: LyricLine) => isAttachedToInstance(line, groupId, instanceIdx);
      const songRange = wholeSongRange(duration);
      const delta = clampShiftDelta(state.lines.filter(isMember), deltaSeconds, songRange);
      if (Math.abs(delta) < MIN_SHIFT_SECONDS) return state;
      return commitHistory(state, {
        lines: state.lines.map((line) =>
          isMember(line) ? reconcileLine({ ...line, ...shiftLineTiming(line, delta) }) : line,
        ),
      });
    }),

  setInstanceOwnTiming: (groupId, instanceIdx, own) => {
    const state = get();
    const groups = state.groups.map((group) => (group.id === groupId ? withOwnTiming(group, instanceIdx, own) : group));
    const realignment = own ? { updates: [] } : realignSharedInstance(state.lines, groups, groupId, instanceIdx);
    if ("refusal" in realignment) return realignment.refusal;
    set(
      commitHistory(
        state,
        { groups, lines: applyLineUpdates(state.lines, realignment.updates) },
        { deriveText: false },
      ),
    );
    return null;
  },

  shareGroupTiming: (groupId) => {
    const state = get();
    const group = state.groups.find((candidate) => candidate.id === groupId);
    if (!group) return [];
    const shared = initialGroupSharing(state.lines, group, true);
    const groups = state.groups.map((candidate) => (candidate.id === groupId ? shared.group : candidate));
    set(commitHistory(state, { groups, lines: shared.lines }, { deriveText: false }));
    return shared.keptOwnTiming;
  },

  placeInstance: (groupId, instanceIdx, start, duration, precedingUpdates = []) => {
    const state = get();
    const songEnd = songEndOrUnbounded(duration);
    const next = commitSharedTimingHistory(
      state,
      applyLineUpdates(state.lines, precedingUpdates),
      precedingUpdates.map((update) => update.id),
      {
        deriveText: false,
        finish: (copied) => {
          const placed = placeSharedInstance(copied, state.groups, groupId, instanceIdx, start, songEnd);
          return placed.length ? applyLineUpdates(copied, placed) : null;
        },
      },
    );
    if (next === state) return false;
    set(next);
    return true;
  },
});

// -- Exports ------------------------------------------------------------------

export { createGroupsSlice, createGroupsInitialState };
