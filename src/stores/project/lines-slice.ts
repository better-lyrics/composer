import { extractLinkedFields, getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { propagateWordChanges } from "@/domain/group/smart-sync";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { withDerivedText } from "@/domain/line/reconstruct-text";
import { closeIntraGroupGaps, computeByGroupId, expandSelectionToGroupmates } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { commitHistory } from "@/stores/project/history-helpers";
import type { LineActions, LinesState, ProjectStore } from "@/stores/project/types";
import { getSplitCharacter } from "@/utils/split-character";
import { addTrailingSpaceIfMissing, resolveOverlapsForward, trimTrailingSpaceFromLast } from "@/utils/word-spaces";
import { applySiblingWords } from "@/utils/word-diff";
import type { StateCreator } from "zustand";

// -- Types --------------------------------------------------------------------

type ExplicitTarget = { lineId: string; field: "words" | "backgroundWords"; wordIndex: number };

// -- Initial State ------------------------------------------------------------

function createLinesInitialState(): LinesState {
  return {
    lines: [],
  };
}

// -- Slice --------------------------------------------------------------------

const createLinesSlice: StateCreator<ProjectStore, [], [], LinesState & LineActions> = (set, get) => ({
  ...createLinesInitialState(),

  setLines: (lines) => set({ lines, isDirty: true, isDirtySinceHistory: true }),

  setLinesWithHistory: (lines) => set((state) => commitHistory(state, { lines })),

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
      const target = state.lines.find((l) => l.id === id);
      const linkScope = target ? getLinkScope(target) : null;
      const linkedUpdates = linkScope ? extractLinkedFields(updates) : null;
      const sourceWordsBefore = target?.words;
      const sourceWordsAfter = updates.words;
      const sourceBgWordsBefore = target?.backgroundWords;
      const sourceBgWordsAfter = updates.backgroundWords;

      const newLines = state.lines.map((line) => {
        if (line.id === id) {
          return reconcileLine({ ...line, ...updates });
        }
        if (isLinkedSibling(line, linkScope)) {
          const siblingUpdates: Partial<LooseLine> = { ...(linkedUpdates ?? {}) };
          const propagatedWords = propagateWordChanges(sourceWordsAfter, sourceWordsBefore, line.words);
          if (propagatedWords) siblingUpdates.words = propagatedWords;
          const propagatedBg = propagateWordChanges(sourceBgWordsAfter, sourceBgWordsBefore, line.backgroundWords);
          if (propagatedBg) siblingUpdates.backgroundWords = propagatedBg;
          if (Object.keys(siblingUpdates).length > 0) {
            return reconcileLine({ ...line, ...siblingUpdates });
          }
        }
        return line;
      });

      return commitHistory(state, { lines: newLines });
    }),

  updateLinesWithHistory: (updates) =>
    set((state) => {
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

      return commitHistory(state, { lines: newLines });
    }),

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
});

// -- Helpers ------------------------------------------------------------------

function expandTargetsToSyllableGroups(targets: ExplicitTarget[], linesById: Map<string, LyricLine>): ExplicitTarget[] {
  const byLineField = new Map<string, { lineId: string; field: "words" | "backgroundWords"; indices: number[] }>();
  for (const t of targets) {
    const key = `${t.lineId}:${t.field}`;
    const existing = byLineField.get(key);
    if (existing) existing.indices.push(t.wordIndex);
    else byLineField.set(key, { lineId: t.lineId, field: t.field, indices: [t.wordIndex] });
  }
  const out: ExplicitTarget[] = [];
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

// -- Exports ------------------------------------------------------------------

export { createLinesSlice, createLinesInitialState };
