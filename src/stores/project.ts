import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { GROUP_COLORS, pickNextGroupColor } from "@/utils/group-colors";
import { applySiblingWords } from "@/utils/word-diff";
import { normalizeTrailingSpaces, resolveOverlapsForward } from "@/utils/word-spaces";
import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type AgentType = "person" | "character" | "group" | "organization" | "other";

interface Agent {
  id: string;
  type: AgentType;
  name?: string;
}

interface WordTiming {
  text: string;
  begin: number;
  end: number;
}

interface LyricLine {
  id: string;
  text: string;
  agentId: string;
  begin?: number;
  end?: number;
  words?: WordTiming[];
  backgroundText?: string;
  backgroundWords?: WordTiming[];
  groupId?: string;
  instanceIdx?: number;
  templateLineIdx?: number;
  detached?: boolean;
}

interface LinkGroup {
  id: string;
  label: string;
  color: string;
  templateVersion: number;
}

interface WordTemplate {
  text: string;
  relativeBegin: number;
  relativeEnd: number;
}

interface LineTemplate {
  text: string;
  agentId: string;
  relativeBegin?: number;
  relativeEnd?: number;
  words?: WordTemplate[];
  backgroundText?: string;
  backgroundWords?: WordTemplate[];
}

type GranularityMode = "line" | "word";
type EditorMode = "simple" | "advanced";
type SimpleTab = "import" | "edit" | "sync" | "timeline" | "preview" | "export";

interface ProjectMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  language?: string;
}

interface HistoryEntry {
  lines: LyricLine[];
  groups: LinkGroup[];
  timestamp: number;
}

interface ProjectState {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  groups: LinkGroup[];
  granularity: GranularityMode;
  editorMode: EditorMode;
  activeTab: SimpleTab;
  isDirty: boolean;
  history: HistoryEntry[];
  historyIndex: number;
  dismissedSuggestions: string[];
}

interface ProjectActions {
  setMetadata: (metadata: Partial<ProjectMetadata>) => void;
  setLines: (lines: LyricLine[]) => void;
  setLinesWithHistory: (lines: LyricLine[]) => void;
  updateLine: (id: string, updates: Partial<LyricLine>) => void;
  updateLineWithHistory: (id: string, updates: Partial<LyricLine>) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  setAgents: (agents: Agent[]) => void;
  setGranularity: (mode: GranularityMode) => void;
  setEditorMode: (mode: EditorMode) => void;
  setActiveTab: (tab: SimpleTab) => void;
  markDirty: () => void;
  markClean: () => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  updateLinesWithHistory: (updates: Array<{ id: string; updates: Partial<LyricLine> }>) => void;
  moveWordToBg: (lineId: string, wordIndices: number[], timeDelta: number, duration: number) => void;
  moveWordFromBg: (lineId: string, wordIndices: number[], timeDelta: number, duration: number) => void;
  setGroups: (groups: LinkGroup[]) => void;
  addGroup: (group: LinkGroup) => void;
  addGroupWithLines: (group: LinkGroup, lines: LyricLine[]) => void;
  groupRepeatingSections: (starts: number[], length: number, options?: { label?: string; color?: string }) => void;
  updateGroup: (id: string, updates: Partial<LinkGroup>) => void;
  removeGroup: (id: string) => void;
  addInstance: (groupId: string, structure: LineTemplate[], instanceStart: number, insertAtIndex?: number) => void;
  removeInstance: (groupId: string, instanceIdx: number) => void;
  detachLine: (lineId: string) => void;
  propagateLinkedEdit: (groupId: string, templateLineIdx: number, lineUpdates: Partial<LyricLine>) => void;
  shiftInstance: (groupId: string, instanceIdx: number, deltaSeconds: number) => void;
  dismissSuggestion: (fingerprint: string) => void;
  setDismissedSuggestions: (fingerprints: string[]) => void;
  clearDismissedSuggestions: () => void;
}

// -- Constants ----------------------------------------------------------------

const AGENT_PRESETS: Agent[] = [
  { id: "v1", type: "person", name: "Lead" },
  { id: "v1000", type: "group", name: "Harmony" },
  { id: "v2000", type: "other", name: "Chorus" },
];

const AGENT_COLORS: Record<string, string> = {
  v1: "#60a5fa", // blue
  v2: "#4ade80", // green
  v3: "#fb923c", // orange
  v4: "#22d3d1", // cyan
  v5: "#facc15", // yellow
  v6: "#fb7185", // rose
  v7: "#2dd4bf", // teal
  v8: "#fbbf24", // amber
  v9: "#818cf8", // indigo
  v10: "#34d399", // emerald
  v11: "#f87171", // red
  v12: "#38bdf8", // sky
  v13: "#a3e635", // lime
  v14: "#e879f9", // fuchsia
  v15: "#a78bfa", // violet
  v1000: "#f472b6", // pink
  v2000: "#c4b5fd", // purple light
};

const DEFAULT_AGENTS: Agent[] = [AGENT_PRESETS[0]];

const MAX_HISTORY_SIZE = 100;

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
  };
}

const INITIAL_STATE: ProjectState = createInitialState();

// -- Store --------------------------------------------------------------------

const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  ...INITIAL_STATE,

  setMetadata: (metadata) =>
    set((state) => ({
      metadata: { ...state.metadata, ...metadata },
      isDirty: true,
    })),

  setLines: (lines) => set({ lines, isDirty: true }),

  setLinesWithHistory: (lines) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      if (newHistory.length === 0) {
        newHistory.push({
          lines: JSON.parse(JSON.stringify(state.lines)),
          groups: JSON.parse(JSON.stringify(state.groups)),
          timestamp: Date.now(),
        });
      }
      newHistory.push({
        lines: JSON.parse(JSON.stringify(lines)),
        groups: JSON.parse(JSON.stringify(state.groups)),
        timestamp: Date.now(),
      });
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }
      return {
        lines,
        isDirty: true,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  updateLine: (id, updates) =>
    set((state) => ({
      lines: state.lines.map((line) => (line.id === id ? { ...line, ...updates } : line)),
      isDirty: true,
    })),

  updateLineWithHistory: (id, updates) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      if (newHistory.length === 0) {
        newHistory.push({
          lines: JSON.parse(JSON.stringify(state.lines)),
          groups: JSON.parse(JSON.stringify(state.groups)),
          timestamp: Date.now(),
        });
      }

      const target = state.lines.find((l) => l.id === id);
      const propagateLinked =
        target !== undefined &&
        target.groupId !== undefined &&
        target.templateLineIdx !== undefined &&
        !target.detached;
      const linkedUpdates = propagateLinked ? extractLinkedFields(updates) : null;
      const linkedGroupId = propagateLinked ? target.groupId : null;
      const linkedTemplateLineIdx = propagateLinked ? target.templateLineIdx : null;
      const sourceWordsBefore = target?.words;
      const sourceWordsAfter = updates.words;
      const sourceBgWordsBefore = target?.backgroundWords;
      const sourceBgWordsAfter = updates.backgroundWords;

      const newLines = state.lines.map((line) => {
        if (line.id === id) {
          const merged = { ...line, ...updates };
          if (updates.words?.length && line.begin !== undefined && !line.words?.length) {
            merged.begin = undefined;
            merged.end = undefined;
          }
          return merged;
        }
        if (
          propagateLinked &&
          line.groupId === linkedGroupId &&
          line.templateLineIdx === linkedTemplateLineIdx &&
          !line.detached
        ) {
          const siblingUpdates: Partial<LyricLine> = { ...(linkedUpdates ?? {}) };
          const propagatedWords = propagateWordChanges(sourceWordsAfter, sourceWordsBefore, line.words);
          if (propagatedWords) siblingUpdates.words = propagatedWords;
          const propagatedBg = propagateWordChanges(sourceBgWordsAfter, sourceBgWordsBefore, line.backgroundWords);
          if (propagatedBg) siblingUpdates.backgroundWords = propagatedBg;
          if (Object.keys(siblingUpdates).length > 0) return { ...line, ...siblingUpdates };
        }
        return line;
      });

      newHistory.push({
        lines: JSON.parse(JSON.stringify(newLines)),
        groups: JSON.parse(JSON.stringify(state.groups)),
        timestamp: Date.now(),
      });

      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }

      return {
        lines: newLines,
        isDirty: true,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  updateLinesWithHistory: (updates) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      if (newHistory.length === 0) {
        newHistory.push({
          lines: JSON.parse(JSON.stringify(state.lines)),
          groups: JSON.parse(JSON.stringify(state.groups)),
          timestamp: Date.now(),
        });
      }

      let newLines = [...state.lines];
      for (const { id, updates: lineUpdates } of updates) {
        const target = newLines.find((l) => l.id === id);
        const linkScope = target ? getLinkScope(target) : null;
        const sourceWordsBefore = target?.words;
        const sourceWordsAfter = lineUpdates.words;
        const sourceBgBefore = target?.backgroundWords;
        const sourceBgAfter = lineUpdates.backgroundWords;
        const linkedUpdates = linkScope ? extractLinkedFields(lineUpdates) : null;

        newLines = newLines.map((line) => {
          if (line.id === id) {
            const merged = { ...line, ...lineUpdates };
            if (lineUpdates.words?.length && line.begin !== undefined && !line.words?.length) {
              merged.begin = undefined;
              merged.end = undefined;
            }
            return merged;
          }
          if (isLinkedSibling(line, linkScope)) {
            const siblingUpdates: Partial<LyricLine> = { ...(linkedUpdates ?? {}) };
            const propagatedWords = propagateWordChanges(sourceWordsAfter, sourceWordsBefore, line.words);
            if (propagatedWords) siblingUpdates.words = propagatedWords;
            const propagatedBg = propagateWordChanges(sourceBgAfter, sourceBgBefore, line.backgroundWords);
            if (propagatedBg) siblingUpdates.backgroundWords = propagatedBg;
            if (Object.keys(siblingUpdates).length > 0) return { ...line, ...siblingUpdates };
          }
          return line;
        });
      }

      newHistory.push({
        lines: JSON.parse(JSON.stringify(newLines)),
        groups: JSON.parse(JSON.stringify(state.groups)),
        timestamp: Date.now(),
      });

      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }

      return {
        lines: newLines,
        isDirty: true,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  addAgent: (agent) =>
    set((state) => ({
      agents: [...state.agents, agent],
      isDirty: true,
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      isDirty: true,
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      isDirty: true,
    })),

  setAgents: (agents) => set({ agents, isDirty: true }),

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

  reset: () => set(createInitialState()),

  undo: () =>
    set((state) => {
      // historyIndex points to current state, so we need > 0 to have something to undo to
      if (state.historyIndex <= 0) return state;
      const entry = state.history[state.historyIndex - 1];
      return {
        lines: JSON.parse(JSON.stringify(entry.lines)),
        groups: JSON.parse(JSON.stringify(entry.groups)),
        historyIndex: state.historyIndex - 1,
        isDirty: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const entry = state.history[state.historyIndex + 1];
      return {
        lines: JSON.parse(JSON.stringify(entry.lines)),
        groups: JSON.parse(JSON.stringify(entry.groups)),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
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
        if (line.id === lineId) {
          const updated = applyMoveToBg(line, wordIndices, timeDelta, duration);
          if (!updated) return line;
          mutated = true;
          return updated;
        }
        if (isLinkedSibling(line, linkScope) && line.words?.length === sourceWordCount) {
          const updated = applyMoveToBg(line, wordIndices, timeDelta, duration);
          if (updated) {
            mutated = true;
            return updated;
          }
        }
        return line;
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
        if (line.id === lineId) {
          const updated = applyMoveFromBg(line, wordIndices, timeDelta, duration);
          if (!updated) return line;
          mutated = true;
          return updated;
        }
        if (isLinkedSibling(line, linkScope) && line.backgroundWords?.length === sourceBgCount) {
          const updated = applyMoveFromBg(line, wordIndices, timeDelta, duration);
          if (updated) {
            mutated = true;
            return updated;
          }
        }
        return line;
      });

      if (!mutated) return state;
      return commitHistory(state, { lines: newLines });
    }),

  setGroups: (groups) => set({ groups: Array.isArray(groups) ? groups : [], isDirty: true }),

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
      const sortedStarts = [...starts].sort((a, b) => a - b);
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
        state.lines
          .filter((l) => l.groupId === groupId && l.instanceIdx !== undefined)
          .map((l) => l.instanceIdx as number),
      );
      let instanceIdx = 0;
      while (usedIndices.has(instanceIdx)) instanceIdx++;

      const newLines: LyricLine[] = structure.map((tplLine, templateLineIdx) => ({
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
              })),
            }
          : {}),
      }));

      const insertedLines =
        insertAtIndex === undefined || insertAtIndex >= state.lines.length || insertAtIndex < 0
          ? [...state.lines, ...newLines]
          : [...state.lines.slice(0, insertAtIndex), ...newLines, ...state.lines.slice(insertAtIndex)];

      return commitHistory(state, { lines: insertedLines });
    }),

  removeInstance: (groupId, instanceIdx) =>
    set((state) => {
      const detachedLines = state.lines.map((line) =>
        line.groupId === groupId && line.instanceIdx === instanceIdx
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

  propagateLinkedEdit: (groupId, templateLineIdx, lineUpdates) =>
    set((state) =>
      commitHistory(state, {
        lines: state.lines.map((line) => {
          if (line.groupId !== groupId) return line;
          if (line.templateLineIdx !== templateLineIdx) return line;
          if (line.detached) return line;
          return { ...line, ...lineUpdates };
        }),
      }),
    ),

  shiftInstance: (groupId, instanceIdx, deltaSeconds) =>
    set((state) =>
      commitHistory(state, {
        lines: state.lines.map((line) => {
          if (line.groupId !== groupId || line.instanceIdx !== instanceIdx) return line;
          return {
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
          };
        }),
      }),
    ),

  dismissSuggestion: (fingerprint) =>
    set((state) => {
      if (state.dismissedSuggestions.includes(fingerprint)) return state;
      return { dismissedSuggestions: [...state.dismissedSuggestions, fingerprint], isDirty: true };
    }),

  setDismissedSuggestions: (fingerprints) => set({ dismissedSuggestions: fingerprints }),

  clearDismissedSuggestions: () => set({ dismissedSuggestions: [], isDirty: true }),
}));

function extractLinkedFields(updates: Partial<LyricLine>): Partial<LyricLine> {
  const linked: Partial<LyricLine> = {};
  if ("text" in updates) linked.text = updates.text;
  if ("agentId" in updates) linked.agentId = updates.agentId;
  if ("backgroundText" in updates) linked.backgroundText = updates.backgroundText;
  if ("words" in updates && updates.words === undefined) linked.words = undefined;
  if ("begin" in updates && updates.begin === undefined) linked.begin = undefined;
  if ("end" in updates && updates.end === undefined) linked.end = undefined;
  if ("backgroundWords" in updates && updates.backgroundWords === undefined) linked.backgroundWords = undefined;
  return linked;
}

interface LinkScope {
  groupId: string;
  templateLineIdx: number;
}

function getLinkScope(line: LyricLine): LinkScope | null {
  if (line.groupId === undefined || line.templateLineIdx === undefined || line.detached) return null;
  return { groupId: line.groupId, templateLineIdx: line.templateLineIdx };
}

function isLinkedSibling(line: LyricLine, scope: LinkScope | null): boolean {
  if (!scope) return false;
  return line.groupId === scope.groupId && line.templateLineIdx === scope.templateLineIdx && !line.detached;
}

function applyMoveToBg(line: LyricLine, wordIndices: number[], timeDelta: number, duration: number): LyricLine | null {
  if (!line.words) return null;
  const indexSet = new Set(wordIndices);
  const movedWords = line.words
    .map((w, i) => ({ word: w, index: i }))
    .filter(({ index }) => indexSet.has(index))
    .map(({ word }) => {
      const dur = word.end - word.begin;
      const newBegin = Math.max(0, Math.min(duration - dur, word.begin + timeDelta));
      return { ...word, begin: newBegin, end: newBegin + dur };
    });

  if (movedWords.length === 0) return null;

  const remainingMain = normalizeTrailingSpaces(line.words.filter((_, i) => !indexSet.has(i)));
  const mergedBg = normalizeTrailingSpaces(
    resolveOverlapsForward(
      [...(line.backgroundWords ?? []), ...movedWords].sort((a, b) => a.begin - b.begin),
      duration,
    ),
  );

  return {
    ...line,
    words: remainingMain,
    backgroundWords: mergedBg,
    backgroundText: mergedBg.map((w) => w.text).join(""),
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
  const movedWords = line.backgroundWords
    .map((w, i) => ({ word: w, index: i }))
    .filter(({ index }) => indexSet.has(index))
    .map(({ word }) => {
      const dur = word.end - word.begin;
      const newBegin = Math.max(0, Math.min(duration - dur, word.begin + timeDelta));
      return { ...word, begin: newBegin, end: newBegin + dur };
    });

  if (movedWords.length === 0) return null;

  const remainingBg = normalizeTrailingSpaces(line.backgroundWords.filter((_, i) => !indexSet.has(i)));
  const mergedMain = normalizeTrailingSpaces(
    resolveOverlapsForward(
      [...(line.words ?? []), ...movedWords].sort((a, b) => a.begin - b.begin),
      duration,
    ),
  );

  const hasBg = remainingBg.length > 0;
  return {
    ...line,
    words: mergedMain,
    backgroundWords: hasBg ? remainingBg : undefined,
    backgroundText: hasBg ? remainingBg.map((w) => w.text).join("") : undefined,
  };
}

function propagateWordChanges(
  sourceAfter: WordTiming[] | undefined,
  sourceBefore: WordTiming[] | undefined,
  siblingWords: WordTiming[] | undefined,
): WordTiming[] | undefined {
  if (!sourceAfter || !siblingWords) return undefined;

  // Fast path for the common text-rename case (count unchanged): only update
  // word texts on the sibling, keep timing exactly. Avoids running the LCS diff.
  if (sourceBefore && sourceAfter.length === sourceBefore.length) {
    if (sourceAfter.length !== siblingWords.length) return undefined;
    let changed = false;
    const next = siblingWords.map((w, i) => {
      if (w.text === sourceAfter[i].text) return w;
      changed = true;
      return { ...w, text: sourceAfter[i].text };
    });
    return changed ? next : undefined;
  }

  // Structural change: defer to the smart-sync diff that preserves sibling
  // timing for words that didn't structurally change.
  const result = applySiblingWords(sourceAfter, sourceBefore, siblingWords);
  return result ?? undefined;
}

function commitHistory(state: ProjectState, changes: { lines?: LyricLine[]; groups?: LinkGroup[] }) {
  const nextLines = changes.lines ?? state.lines;
  const nextGroups = changes.groups ?? state.groups;

  const newHistory = state.history.slice(0, state.historyIndex + 1);
  if (newHistory.length === 0) {
    newHistory.push({
      lines: JSON.parse(JSON.stringify(state.lines)),
      groups: JSON.parse(JSON.stringify(state.groups)),
      timestamp: Date.now(),
    });
  }
  newHistory.push({
    lines: JSON.parse(JSON.stringify(nextLines)),
    groups: JSON.parse(JSON.stringify(nextGroups)),
    timestamp: Date.now(),
  });
  if (newHistory.length > MAX_HISTORY_SIZE) newHistory.shift();
  return {
    lines: nextLines,
    groups: nextGroups,
    isDirty: true,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

function getAgentColor(agentId: string): string {
  return AGENT_COLORS[agentId] ?? "#9ca3af"; // gray fallback
}

export { useProjectStore, DEFAULT_AGENTS, AGENT_PRESETS, AGENT_COLORS, getAgentColor, INITIAL_STATE };
export { extractLinkedFields, propagateWordChanges };

export type {
  Agent,
  AgentType,
  EditorMode,
  GranularityMode,
  LineTemplate,
  LinkGroup,
  LyricLine,
  ProjectMetadata,
  ProjectState,
  SimpleTab,
  WordTemplate,
  WordTiming,
};
