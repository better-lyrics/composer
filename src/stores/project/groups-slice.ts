import { initialSharing } from "@/domain/group/initial-sharing";
import { unlinkLines } from "@/domain/group/linking";
import { withNewInstance, withOwnTiming, withSharing } from "@/domain/group/own-timing";
import { placeSharedInstance, realignSharedInstance } from "@/domain/group/shared-placement";
import { instanceStart, sharedTimingFanOut } from "@/domain/group/shared-timing";
import { type LinkGroup, offsetTemplateWords } from "@/domain/group/template";
import { nextInstanceIdx } from "@/domain/instance/enumerate";
import { belongsToInstance } from "@/domain/instance/predicates";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { clampShiftDelta, shiftLineTiming } from "@/domain/line/shift";
import { notifySharedTimingCopied } from "@/lib/shared-timing-signals";
import { commitHistory } from "@/stores/project/history-helpers";
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

  groupRepeatingSections: (starts, length, options = {}) =>
    set((state) => {
      if (starts.length < 2 || length < 1) return state;

      const covered = new Set<number>();
      for (const start of starts) {
        for (let p = start; p < start + length; p++) {
          if (p < 0 || p >= state.lines.length) return state;
          if (state.lines[p].groupId !== undefined) return state;
          if (covered.has(p)) return state;
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

      const group: LinkGroup = {
        id: groupId,
        label,
        color,
        templateVersion: 1,
        ...initialSharing(updatedLines, groupId, useSettingsStore.getState().shareTimingInNewGroups),
      };

      return commitHistory(state, { groups: [...state.groups, group], lines: updatedLines });
    }),

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
      const isMember = (line: LyricLine) => belongsToInstance(line, groupId, instanceIdx) && !line.detached;
      const songRange = { min: 0, max: songEndOrUnbounded(duration) };
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
    const placed = own ? [] : realignSharedInstance(state.lines, groups, groupId, instanceIdx);
    if (!own && placed.length === 0 && instanceStart(state.lines, groupId, instanceIdx) !== null) return false;
    set(commitHistory(state, { groups, lines: applyLineUpdates(state.lines, placed) }, { deriveText: false }));
    return true;
  },

  shareGroupTiming: (groupId) =>
    set((state) =>
      commitHistory(state, {
        groups: state.groups.map((group) =>
          group.id === groupId ? withSharing(group, initialSharing(state.lines, groupId, true)) : group,
        ),
      }),
    ),

  shareAllInstances: (groupId) =>
    set((state) => {
      const group = state.groups.find((candidate) => candidate.id === groupId);
      if (!group) return state;
      const shared = state.groups.map((candidate) =>
        candidate.id === groupId ? withSharing(candidate, { sharesTiming: true }) : candidate,
      );
      let lines = state.lines;
      const keptOwn: number[] = [];
      for (const instanceIdx of group.ownTimingInstances ?? []) {
        const placed = realignSharedInstance(lines, shared, groupId, instanceIdx);
        if (placed.length === 0 && instanceStart(lines, groupId, instanceIdx) !== null) keptOwn.push(instanceIdx);
        lines = applyLineUpdates(lines, placed);
      }
      const groups = keptOwn.length
        ? state.groups.map((candidate) =>
            candidate.id === groupId
              ? withSharing(candidate, { sharesTiming: true, ownTimingInstances: keptOwn })
              : candidate,
          )
        : shared;
      return commitHistory(state, { groups, lines }, { deriveText: false });
    }),

  placeInstance: (groupId, instanceIdx, start, duration, precedingUpdates = []) => {
    const state = get();
    const preceded = sharedTimingFanOut(
      state.lines,
      applyLineUpdates(state.lines, precedingUpdates),
      state.groups,
      precedingUpdates.map((update) => update.id),
    );
    if (preceded.rejected) return false;
    const songEnd = songEndOrUnbounded(duration);
    const placed = placeSharedInstance(preceded.lines, state.groups, groupId, instanceIdx, start, songEnd);
    if (placed.length === 0) return false;
    if (preceded.touchedGroupIds.length) notifySharedTimingCopied(preceded.touchedGroupIds);
    set(commitHistory(state, { lines: applyLineUpdates(preceded.lines, placed) }, { deriveText: false }));
    return true;
  },
});

// -- Exports ------------------------------------------------------------------

export { createGroupsSlice, createGroupsInitialState };
