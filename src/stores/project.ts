import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { extractLinkedFields, getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { propagateWordChanges } from "@/domain/group/smart-sync";
import type { LinkGroup } from "@/domain/group/template";
import { belongsToInstance } from "@/domain/instance/predicates";
import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { withDerivedText } from "@/domain/line/reconstruct-text";
import { closeIntraGroupGaps, computeByGroupId, expandSelectionToGroupmates } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { createAgentsSlice } from "@/stores/project/agents-slice";
import { commitHistory, MAX_HISTORY_SIZE } from "@/stores/project/history-helpers";
import { createMetadataSlice } from "@/stores/project/metadata-slice";
import type { ProjectState, ProjectStore } from "@/stores/project/types";
import { useSettingsStore } from "@/stores/settings";
import { getSplitCharacter } from "@/utils/split-character";
import { GROUP_COLORS, pickNextGroupColor } from "@/utils/group-colors";
import { applySiblingWords } from "@/utils/word-diff";
import { addTrailingSpaceIfMissing, resolveOverlapsForward, trimTrailingSpaceFromLast } from "@/utils/word-spaces";
import { create } from "zustand";

// -- Initial State ------------------------------------------------------------

function createInitialState(): ProjectState {
  return {
    metadata: {
      title: "",
      artist: "",
      album: "",
      duration: 0,
    },
    agents: DEFAULT_AGENTS,
    lines: [],
    groups: [],
    granularity: useSettingsStore.getState().defaultGranularity,
    editorMode: "simple",
    activeTab: "import",
    isDirty: false,
    history: [],
    historyIndex: -1,
    dismissedSuggestions: [],
    dismissedExplicitSuggestions: [],
    isDirtySinceHistory: false,
  };
}

const INITIAL_STATE: ProjectState = createInitialState();

// -- Store --------------------------------------------------------------------

const useProjectStore = create<ProjectStore>((set, get, api) => ({
  ...INITIAL_STATE,

  ...createMetadataSlice(set, get, api),

  setLines: (lines) => set({ lines, isDirty: true, isDirtySinceHistory: true }),

  setLinesWithHistory: (lines) =>
    set((state) => {
      const splitChar = getSplitCharacter();
      const derivedLines = lines.map((line) => withDerivedText(line, splitChar));
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      if (newHistory.length === 0 || state.isDirtySinceHistory) {
        newHistory.push({
          lines: structuredClone(state.lines),
          groups: structuredClone(state.groups),
          timestamp: Date.now(),
        });
      }
      newHistory.push({
        lines: structuredClone(derivedLines),
        groups: structuredClone(state.groups),
        timestamp: Date.now(),
      });
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }
      return {
        lines: derivedLines,
        isDirty: true,
        isDirtySinceHistory: false,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  updateLine: (id, updates) =>
    set((state) => {
      const splitChar = getSplitCharacter();
      return {
        lines: state.lines.map((line) =>
          line.id === id ? withDerivedText(reconcileLine({ ...line, ...updates }), splitChar) : line,
        ),
        isDirty: true,
        isDirtySinceHistory: true,
      };
    }),

  updateLineWithHistory: (id, updates) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      if (newHistory.length === 0 || state.isDirtySinceHistory) {
        newHistory.push({
          lines: structuredClone(state.lines),
          groups: structuredClone(state.groups),
          timestamp: Date.now(),
        });
      }

      const target = state.lines.find((l) => l.id === id);
      const linkScope = target ? getLinkScope(target) : null;
      const linkedUpdates = linkScope ? extractLinkedFields(updates) : null;
      const sourceWordsBefore = target?.words;
      const sourceWordsAfter = updates.words;
      const sourceBgWordsBefore = target?.backgroundWords;
      const sourceBgWordsAfter = updates.backgroundWords;

      const splitChar = getSplitCharacter();
      const newLines = state.lines.map((line) => {
        if (line.id === id) {
          return withDerivedText(reconcileLine({ ...line, ...updates }), splitChar);
        }
        if (isLinkedSibling(line, linkScope)) {
          const siblingUpdates: Partial<LooseLine> = { ...(linkedUpdates ?? {}) };
          const propagatedWords = propagateWordChanges(sourceWordsAfter, sourceWordsBefore, line.words);
          if (propagatedWords) siblingUpdates.words = propagatedWords;
          const propagatedBg = propagateWordChanges(sourceBgWordsAfter, sourceBgWordsBefore, line.backgroundWords);
          if (propagatedBg) siblingUpdates.backgroundWords = propagatedBg;
          if (Object.keys(siblingUpdates).length > 0) {
            return withDerivedText(reconcileLine({ ...line, ...siblingUpdates }), splitChar);
          }
        }
        return line;
      });

      newHistory.push({
        lines: structuredClone(newLines),
        groups: structuredClone(state.groups),
        timestamp: Date.now(),
      });

      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }

      return {
        lines: newLines,
        isDirty: true,
        isDirtySinceHistory: false,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  updateLinesWithHistory: (updates) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      if (newHistory.length === 0 || state.isDirtySinceHistory) {
        newHistory.push({
          lines: structuredClone(state.lines),
          groups: structuredClone(state.groups),
          timestamp: Date.now(),
        });
      }

      const newLines = [...state.lines];
      const indexById = new Map<string, number>();
      for (let i = 0; i < newLines.length; i++) indexById.set(newLines[i].id, i);

      for (const { id, updates: lineUpdates } of updates) {
        const targetIdx = indexById.get(id);
        const target = targetIdx !== undefined ? newLines[targetIdx] : undefined;
        const linkScope = target ? getLinkScope(target) : null;
        const sourceWordsBefore = target?.words;
        const sourceWordsAfter = lineUpdates.words;
        const sourceBgBefore = target?.backgroundWords;
        const sourceBgAfter = lineUpdates.backgroundWords;
        const linkedUpdates = linkScope ? extractLinkedFields(lineUpdates) : null;

        if (targetIdx !== undefined && target) {
          newLines[targetIdx] = reconcileLine({ ...target, ...lineUpdates });
        }

        if (linkScope) {
          for (let i = 0; i < newLines.length; i++) {
            const line = newLines[i];
            if (line.id === id) continue;
            if (!isLinkedSibling(line, linkScope)) continue;
            const siblingUpdates: Partial<LooseLine> = { ...(linkedUpdates ?? {}) };
            const propagatedWords = propagateWordChanges(sourceWordsAfter, sourceWordsBefore, line.words);
            if (propagatedWords) siblingUpdates.words = propagatedWords;
            const propagatedBg = propagateWordChanges(sourceBgAfter, sourceBgBefore, line.backgroundWords);
            if (propagatedBg) siblingUpdates.backgroundWords = propagatedBg;
            if (Object.keys(siblingUpdates).length > 0) newLines[i] = reconcileLine({ ...line, ...siblingUpdates });
          }
        }
      }

      const splitChar = getSplitCharacter();
      for (let i = 0; i < newLines.length; i++) {
        newLines[i] = withDerivedText(newLines[i], splitChar);
      }

      newHistory.push({
        lines: structuredClone(newLines),
        groups: structuredClone(state.groups),
        timestamp: Date.now(),
      });

      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }

      return {
        lines: newLines,
        isDirty: true,
        isDirtySinceHistory: false,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  ...createAgentsSlice(set, get, api),

  setGranularity: (granularity) => set({ granularity, isDirty: true }),

  setEditorMode: (editorMode) => set({ editorMode }),

  setActiveTab: (activeTab) => {
    if (activeTab === "export") {
      useAudioStore.getState().setIsPlaying(false);
    }
    set({ activeTab });
  },

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  undo: () =>
    set((state) => {
      // historyIndex points to current state, so we need > 0 to have something to undo to
      if (state.historyIndex <= 0) return state;
      const entry = state.history[state.historyIndex - 1];
      return {
        lines: structuredClone(entry.lines),
        groups: structuredClone(entry.groups),
        historyIndex: state.historyIndex - 1,
        isDirty: true,
        isDirtySinceHistory: false,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const entry = state.history[state.historyIndex + 1];
      return {
        lines: structuredClone(entry.lines),
        groups: structuredClone(entry.groups),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
        isDirtySinceHistory: false,
      };
    }),

  canUndo: () => get().historyIndex > 0,

  canRedo: () => get().historyIndex < get().history.length - 1,

  clearHistory: () => set({ history: [], historyIndex: -1 }),

  moveWordToBg: (lineId, wordIndices, timeDelta, duration) =>
    set((state) => {
      const sourceLine = state.lines.find((l) => l.id === lineId);
      if (!sourceLine?.words || wordIndices.length === 0) return state;
      const sourceWordCount = sourceLine.words.length;
      const linkScope = getLinkScope(sourceLine);

      let mutated = false;
      const newLines = state.lines.map((line) => {
        const isSource = line.id === lineId;
        const isSibling = !isSource && isLinkedSibling(line, linkScope) && line.words?.length === sourceWordCount;
        if (!isSource && !isSibling) return line;
        const expanded = expandSelectionToGroupmates(line.words ?? [], wordIndices);
        const updated = applyMoveToBg(line, expanded, timeDelta, duration);
        if (!updated) return line;
        mutated = true;
        return updated;
      });

      if (!mutated) return state;
      return commitHistory(state, { lines: newLines });
    }),

  moveWordFromBg: (lineId, wordIndices, timeDelta, duration) =>
    set((state) => {
      const sourceLine = state.lines.find((l) => l.id === lineId);
      if (!sourceLine?.backgroundWords || wordIndices.length === 0) return state;
      const sourceBgCount = sourceLine.backgroundWords.length;
      const linkScope = getLinkScope(sourceLine);

      let mutated = false;
      const newLines = state.lines.map((line) => {
        const isSource = line.id === lineId;
        const isSibling =
          !isSource && isLinkedSibling(line, linkScope) && line.backgroundWords?.length === sourceBgCount;
        if (!isSource && !isSibling) return line;
        const expanded = expandSelectionToGroupmates(line.backgroundWords ?? [], wordIndices);
        const updated = applyMoveFromBg(line, expanded, timeDelta, duration);
        if (!updated) return line;
        mutated = true;
        return updated;
      });

      if (!mutated) return state;
      return commitHistory(state, { lines: newLines });
    }),

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

      const group: LinkGroup = { id: groupId, label, color, templateVersion: 1 };

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
        lines: state.lines.map((line) =>
          line.groupId === id
            ? {
                ...line,
                groupId: undefined,
                instanceIdx: undefined,
                templateLineIdx: undefined,
                detached: undefined,
              }
            : line,
        ),
      }),
    ),

  addInstance: (groupId, structure, instanceStart, insertAtIndex) =>
    set((state) => {
      const usedIndices = new Set(
        state.lines.flatMap((l) => (l.groupId === groupId && l.instanceIdx !== undefined ? [l.instanceIdx] : [])),
      );
      let instanceIdx = 0;
      while (usedIndices.has(instanceIdx)) instanceIdx++;

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
                words: tplLine.words.map((w) => ({
                  text: w.text,
                  begin: w.relativeBegin + instanceStart,
                  end: w.relativeEnd + instanceStart,
                  ...(w.explicit ? { explicit: true as const } : {}),
                })),
              }
            : {}),
          ...(tplLine.backgroundText !== undefined ? { backgroundText: tplLine.backgroundText } : {}),
          ...(tplLine.backgroundWords
            ? {
                backgroundWords: tplLine.backgroundWords.map((w) => ({
                  text: w.text,
                  begin: w.relativeBegin + instanceStart,
                  end: w.relativeEnd + instanceStart,
                  ...(w.explicit ? { explicit: true as const } : {}),
                })),
              }
            : {}),
        }),
      );

      const insertedLines =
        insertAtIndex === undefined || insertAtIndex >= state.lines.length || insertAtIndex < 0
          ? [...state.lines, ...newLines]
          : [...state.lines.slice(0, insertAtIndex), ...newLines, ...state.lines.slice(insertAtIndex)];

      return commitHistory(state, { lines: insertedLines });
    }),

  removeInstance: (groupId, instanceIdx) =>
    set((state) => {
      const detachedLines = state.lines.map((line) =>
        belongsToInstance(line, groupId, instanceIdx)
          ? {
              ...line,
              groupId: undefined,
              instanceIdx: undefined,
              templateLineIdx: undefined,
              detached: undefined,
            }
          : line,
      );

      const remainingInGroup = detachedLines.some((l) => l.groupId === groupId);
      const nextGroups = remainingInGroup ? state.groups : state.groups.filter((g) => g.id !== groupId);

      return commitHistory(state, { lines: detachedLines, groups: nextGroups });
    }),

  detachLine: (lineId) =>
    set((state) =>
      commitHistory(state, {
        lines: state.lines.map((line) =>
          line.id === lineId
            ? {
                ...line,
                groupId: undefined,
                instanceIdx: undefined,
                templateLineIdx: undefined,
                detached: undefined,
              }
            : line,
        ),
      }),
    ),

  shiftInstance: (groupId, instanceIdx, deltaSeconds) =>
    set((state) =>
      commitHistory(state, {
        lines: state.lines.map((line) => {
          if (line.groupId !== groupId || line.instanceIdx !== instanceIdx || line.detached) return line;
          return reconcileLine({
            ...line,
            begin: line.begin !== undefined ? line.begin + deltaSeconds : undefined,
            end: line.end !== undefined ? line.end + deltaSeconds : undefined,
            words: line.words?.map((w) => ({
              ...w,
              begin: w.begin + deltaSeconds,
              end: w.end + deltaSeconds,
            })),
            backgroundWords: line.backgroundWords?.map((w) => ({
              ...w,
              begin: w.begin + deltaSeconds,
              end: w.end + deltaSeconds,
            })),
          });
        }),
      }),
    ),

  applyWordCountChange: (lineId, newWords, field, resolution, extraUpdates = {}) =>
    set((state) => {
      if (resolution === "cancel") return state;
      const target = state.lines.find((l) => l.id === lineId);
      if (!target) return state;

      const sourceBefore = target[field];
      const linkScope = getLinkScope(target);

      if (resolution === "detach") {
        return commitHistory(state, {
          lines: state.lines.map((line) => {
            if (line.id !== lineId) return line;
            return reconcileLine({
              ...line,
              ...extraUpdates,
              [field]: newWords,
              groupId: undefined,
              instanceIdx: undefined,
              templateLineIdx: undefined,
              detached: undefined,
            });
          }),
        });
      }

      const linkedExtras = linkScope ? extractLinkedFields(extraUpdates) : null;

      const newLines = state.lines.map((line) => {
        if (line.id === lineId) {
          return reconcileLine({ ...line, ...extraUpdates, [field]: newWords });
        }
        if (isLinkedSibling(line, linkScope)) {
          const propagated = applySiblingWords(newWords, sourceBefore, line[field]);
          const siblingUpdates: Partial<LooseLine> = { ...(linkedExtras ?? {}) };
          if (propagated) siblingUpdates[field] = propagated;
          if (Object.keys(siblingUpdates).length > 0) return reconcileLine({ ...line, ...siblingUpdates });
        }
        return line;
      });

      return commitHistory(state, { lines: newLines });
    }),

  toggleWordExplicit: (lineId, field, wordIndices) => {
    if (wordIndices.length === 0) return;
    const state = get();
    const target = state.lines.find((l) => l.id === lineId);
    if (!target) return;
    const currentWords = target[field];
    if (!currentWords || currentWords.length === 0) return;

    const filtered = wordIndices.filter((i) => i >= 0 && i < currentWords.length);
    const expanded = expandSelectionToGroupmates(currentWords, filtered).filter((i) => i < currentWords.length);
    const indexSet = new Set(expanded);
    if (indexSet.size === 0) return;

    const allMarked = Array.from(indexSet).every((i) => currentWords[i].explicit === true);
    const nextExplicit = !allMarked;

    const newWords: WordTiming[] = currentWords.map((word, i) => {
      if (!indexSet.has(i)) return word;
      if (nextExplicit) return { ...word, explicit: true };
      const { explicit: _explicit, ...rest } = word;
      return rest;
    });

    get().applyWordCountChange(lineId, newWords, field, "apply");
  },

  mergeSyllableGroupIntoWord: (lineId, field, wordIndices) =>
    set((state) => {
      if (wordIndices.length === 0) return state;
      const target = state.lines.find((l) => l.id === lineId);
      if (!target) return state;
      const sourceWords = target[field];
      if (!sourceWords || sourceWords.length === 0) return state;
      const sourceCount = sourceWords.length;
      const selected = new Set(wordIndices.filter((i) => i >= 0 && i < sourceCount));
      if (selected.size === 0) return state;

      const linkScope = getLinkScope(target);
      let mutated = false;
      const newLines = state.lines.map((line) => {
        const isSource = line.id === lineId;
        const isSibling = !isSource && isLinkedSibling(line, linkScope) && line[field]?.length === sourceCount;
        if (!isSource && !isSibling) return line;
        const lineWords = line[field];
        if (!lineWords) return line;

        const runs = computeByGroupId(lineWords);
        const collapsed: WordTiming[] = [];
        let changed = false;
        let runIdx = 0;
        let i = 0;
        while (i < lineWords.length) {
          const run = runs[runIdx];
          if (!run || run.startIndex !== i) {
            collapsed.push(lineWords[i]);
            i++;
            continue;
          }
          runIdx++;
          let touched = false;
          for (let k = run.startIndex; k <= run.endIndex; k++) if (selected.has(k)) touched = true;
          if (touched) {
            const first = lineWords[run.startIndex];
            const { syllableGroupId: _drop, ...rest } = first;
            collapsed.push({
              ...rest,
              text: lineWords
                .slice(run.startIndex, run.endIndex + 1)
                .map((w) => w.text)
                .join(""),
              begin: first.begin,
              end: lineWords[run.endIndex].end,
            });
            changed = true;
          } else {
            for (let k = run.startIndex; k <= run.endIndex; k++) collapsed.push(lineWords[k]);
          }
          i = run.endIndex + 1;
        }
        if (!changed) return line;
        mutated = true;
        return reconcileLine({ ...line, [field]: collapsed });
      });
      if (!mutated) return state;
      return commitHistory(state, { lines: newLines });
    }),

  snapSyllablesFlush: (lineId, field) =>
    set((state) => {
      const target = state.lines.find((l) => l.id === lineId);
      if (!target) return state;
      const lineWords = target[field];
      if (!lineWords) return state;
      const snapped = closeIntraGroupGaps(lineWords);
      if (snapped === lineWords) return state;
      const newLines = state.lines.map((l) => (l.id === lineId ? { ...l, [field]: snapped } : l));
      return commitHistory(state, { lines: newLines });
    }),

  markWordsExplicit: (targets, value) =>
    set((state) => {
      if (targets.length === 0) return state;
      let lines = state.lines;
      let changed = false;
      const linesById = new Map<string, LyricLine>();
      for (const l of lines) linesById.set(l.id, l);

      const expandedTargets = expandTargetsToSyllableGroups(targets, linesById);

      for (const target of expandedTargets) {
        const line = linesById.get(target.lineId);
        if (!line) continue;
        const currentWords = line[target.field];
        if (!currentWords || target.wordIndex < 0 || target.wordIndex >= currentWords.length) continue;
        if ((currentWords[target.wordIndex].explicit === true) === value) continue;

        const newWords: WordTiming[] = currentWords.map((word, i) => {
          if (i !== target.wordIndex) return word;
          if (value) return { ...word, explicit: true as const };
          const { explicit: _explicit, ...rest } = word;
          return rest;
        });

        const before = lines;
        lines = applyExplicitTargetToLines(lines, target.lineId, target.field, newWords);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] !== before[i]) linesById.set(lines[i].id, lines[i]);
        }
        changed = true;
      }
      if (!changed) return state;
      return commitHistory(state, { lines });
    }),

  dismissSuggestion: (fingerprint) =>
    set((state) => {
      if (state.dismissedSuggestions.includes(fingerprint)) return state;
      return { dismissedSuggestions: [...state.dismissedSuggestions, fingerprint], isDirty: true };
    }),

  setDismissedSuggestions: (fingerprints) => set({ dismissedSuggestions: fingerprints }),

  clearDismissedSuggestions: () => set({ dismissedSuggestions: [], isDirty: true }),

  dismissExplicitSuggestion: (fingerprint) =>
    set((state) => {
      if (state.dismissedExplicitSuggestions.includes(fingerprint)) return state;
      return {
        dismissedExplicitSuggestions: [...state.dismissedExplicitSuggestions, fingerprint],
        isDirty: true,
      };
    }),

  setDismissedExplicitSuggestions: (fingerprints) => set({ dismissedExplicitSuggestions: fingerprints }),

  clearDismissedExplicitSuggestions: () => set({ dismissedExplicitSuggestions: [], isDirty: true }),
}));

function expandTargetsToSyllableGroups(
  targets: { lineId: string; field: "words" | "backgroundWords"; wordIndex: number }[],
  linesById: Map<string, LyricLine>,
): { lineId: string; field: "words" | "backgroundWords"; wordIndex: number }[] {
  const byLineField = new Map<string, { lineId: string; field: "words" | "backgroundWords"; indices: number[] }>();
  for (const t of targets) {
    const key = `${t.lineId}:${t.field}`;
    const existing = byLineField.get(key);
    if (existing) existing.indices.push(t.wordIndex);
    else byLineField.set(key, { lineId: t.lineId, field: t.field, indices: [t.wordIndex] });
  }
  const out: { lineId: string; field: "words" | "backgroundWords"; wordIndex: number }[] = [];
  for (const group of byLineField.values()) {
    const line = linesById.get(group.lineId);
    const currentWords = line?.[group.field];
    const expanded = currentWords ? expandSelectionToGroupmates(currentWords, group.indices) : group.indices;
    for (const idx of expanded) out.push({ lineId: group.lineId, field: group.field, wordIndex: idx });
  }
  return out;
}

function applyExplicitTargetToLines(
  lines: LyricLine[],
  lineId: string,
  field: "words" | "backgroundWords",
  newWords: WordTiming[],
): LyricLine[] {
  const target = lines.find((l) => l.id === lineId);
  if (!target) return lines;
  const sourceBefore = target[field];
  const linkScope = getLinkScope(target);

  return lines.map((line) => {
    if (line.id === lineId) {
      return { ...line, [field]: newWords };
    }
    if (isLinkedSibling(line, linkScope)) {
      const propagated = applySiblingWords(newWords, sourceBefore, line[field]);
      if (propagated) return { ...line, [field]: propagated };
    }
    return line;
  });
}

function applyMoveToBg(line: LyricLine, wordIndices: number[], timeDelta: number, duration: number): LyricLine | null {
  if (!line.words) return null;
  const indexSet = new Set(wordIndices);
  const movedWords = line.words.flatMap((word, index) => {
    if (!indexSet.has(index)) return [];
    const dur = word.end - word.begin;
    const newBegin = Math.max(0, Math.min(duration - dur, word.begin + timeDelta));
    return [{ ...word, begin: newBegin, end: newBegin + dur }];
  });

  if (movedWords.length === 0) return null;

  const remainingMain = trimTrailingSpaceFromLast(line.words.filter((_, i) => !indexSet.has(i)));

  const prevBgLast = line.backgroundWords?.[line.backgroundWords.length - 1];
  const sortedBg = [...(line.backgroundWords ?? []), ...movedWords].sort((a, b) => a.begin - b.begin);
  const reconciledBg = prevBgLast ? addTrailingSpaceIfMissing(sortedBg, prevBgLast) : sortedBg;
  const mergedBg = trimTrailingSpaceFromLast(resolveOverlapsForward(reconciledBg, duration));

  return {
    ...line,
    words: remainingMain,
    backgroundWords: mergedBg,
  };
}

function applyMoveFromBg(
  line: LyricLine,
  wordIndices: number[],
  timeDelta: number,
  duration: number,
): LyricLine | null {
  if (!line.backgroundWords) return null;
  const indexSet = new Set(wordIndices);
  const movedWords = line.backgroundWords.flatMap((word, index) => {
    if (!indexSet.has(index)) return [];
    const dur = word.end - word.begin;
    const newBegin = Math.max(0, Math.min(duration - dur, word.begin + timeDelta));
    return [{ ...word, begin: newBegin, end: newBegin + dur }];
  });

  if (movedWords.length === 0) return null;

  const remainingBg = trimTrailingSpaceFromLast(line.backgroundWords.filter((_, i) => !indexSet.has(i)));

  const prevMainLast = line.words?.[line.words.length - 1];
  const sortedMain = [...(line.words ?? []), ...movedWords].sort((a, b) => a.begin - b.begin);
  const reconciledMain = prevMainLast ? addTrailingSpaceIfMissing(sortedMain, prevMainLast) : sortedMain;
  const mergedMain = trimTrailingSpaceFromLast(resolveOverlapsForward(reconciledMain, duration));

  const hasBg = remainingBg.length > 0;
  return reconcileLine({
    ...line,
    words: mergedMain,
    backgroundWords: hasBg ? remainingBg : undefined,
    backgroundText: hasBg ? line.backgroundText : undefined,
  });
}

export { useProjectStore, INITIAL_STATE };

export type { GranularityMode, SimpleTab } from "@/stores/project/types";
