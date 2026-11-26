import type { LyricCommand } from "@/domain/commands/command";
import { type LyricRoot, type Outcome, applied, refused, withLines } from "@/domain/commands/outcome";
import { extractLinkedFields, getLinkScope, isLinkedSibling, unlinkLines } from "@/domain/group/linking";
import { withOwnPieces } from "@/domain/language/pieces";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { type ExplicitTarget, applyMarkWordsExplicit, applyMergeSyllableGroup } from "@/domain/line/word-track-edits";
import { applySyllableSplitToLines } from "@/domain/word/identical-syllable-split";
import type { IdenticalMatchSource } from "@/utils/identical-word-matcher";
import { closeIntraGroupGaps, expandSelectionToGroupmates } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { applySiblingWords } from "@/utils/word-diff";

// -- Types --------------------------------------------------------------------

type WordField = "words" | "backgroundWords";
type WordCountResolution = "apply" | "detach" | "cancel";

// -- Helpers ------------------------------------------------------------------

function wordCountChange(
  root: LyricRoot,
  lineId: string,
  newWords: WordTiming[],
  field: WordField,
  resolution: WordCountResolution,
  extraUpdates: Partial<LyricLine>,
): Outcome {
  if (resolution === "cancel") return applied(root, []);
  const target = root.lines.find((line) => line.id === lineId);
  if (!target) return refused({ reason: "line-gone", lineId });

  if (resolution === "detach") {
    const edited = root.lines.map((line) =>
      line.id === lineId ? reconcileLine({ ...line, ...extraUpdates, [field]: newWords }) : line,
    );
    return withLines(
      root,
      unlinkLines(edited, (line) => line.id === lineId),
    );
  }

  const sourceBefore = target[field];
  const linkScope = getLinkScope(target);
  const linkedExtras = linkScope ? extractLinkedFields(extraUpdates) : null;
  const lines = root.lines.map((line) => {
    if (line.id === lineId) return reconcileLine({ ...line, ...extraUpdates, [field]: newWords });
    if (isLinkedSibling(line, linkScope)) {
      const propagated = applySiblingWords(newWords, sourceBefore, line[field]);
      const siblingUpdates: Partial<LooseLine> = { ...(linkedExtras ?? {}) };
      if ("languages" in siblingUpdates) siblingUpdates.languages = withOwnPieces(siblingUpdates.languages, line);
      if (propagated) siblingUpdates[field] = propagated;
      if (Object.keys(siblingUpdates).length > 0) return reconcileLine({ ...line, ...siblingUpdates });
    }
    return line;
  });
  return withLines(root, lines);
}

function toggledExplicitWords(words: WordTiming[], wordIndices: readonly number[]): WordTiming[] | null {
  const filtered = wordIndices.filter((i) => i >= 0 && i < words.length);
  const expanded = expandSelectionToGroupmates(words, filtered).filter((i) => i < words.length);
  const indexSet = new Set(expanded);
  if (indexSet.size === 0) return null;
  const nextExplicit = !Array.from(indexSet).every((i) => words[i].explicit === true);
  return words.map((word, i) => {
    if (!indexSet.has(i)) return word;
    if (nextExplicit) return { ...word, explicit: true };
    const { explicit: _explicit, ...rest } = word;
    return rest;
  });
}

// -- Commands -----------------------------------------------------------------

function applyWordCountChange(
  lineId: string,
  newWords: WordTiming[],
  field: WordField,
  resolution: WordCountResolution,
  extraUpdates: Partial<LyricLine> = {},
): LyricCommand {
  return {
    note: { command: "change word count", args: [lineId, field, resolution] },
    derivesText: true,
    copiesSharedTiming: true,
    run: (root) => wordCountChange(root, lineId, newWords, field, resolution, extraUpdates),
  };
}

function toggleWordExplicit(lineId: string, field: WordField, wordIndices: readonly number[]): LyricCommand {
  return {
    note: { command: "toggle explicit", args: [lineId, field, ...wordIndices] },
    derivesText: true,
    copiesSharedTiming: true,
    run: (root) => {
      if (wordIndices.length === 0) return applied(root, []);
      const target = root.lines.find((line) => line.id === lineId);
      if (!target) return refused({ reason: "line-gone", lineId });
      const currentWords = target[field];
      if (!currentWords || currentWords.length === 0) return applied(root, []);
      const newWords = toggledExplicitWords(currentWords, wordIndices);
      if (!newWords) return applied(root, []);
      const extraUpdates = field === "backgroundWords" ? manualBackgroundWordEdit(newWords) : {};
      return wordCountChange(root, lineId, newWords, field, "apply", extraUpdates);
    },
  };
}

function mergeSyllableGroup(lineId: string, field: WordField, wordIndices: number[]): LyricCommand {
  return {
    note: { command: "merge syllables", args: [lineId, field, ...wordIndices] },
    derivesText: true,
    copiesSharedTiming: true,
    run: (root) => withLines(root, applyMergeSyllableGroup(root.lines, lineId, field, wordIndices)),
  };
}

function snapSyllablesFlush(lineId: string, field: WordField): LyricCommand {
  return {
    note: { command: "snap syllables", args: [lineId, field] },
    derivesText: true,
    copiesSharedTiming: true,
    run: (root) => {
      const target = root.lines.find((line) => line.id === lineId);
      if (!target) return refused({ reason: "line-gone", lineId });
      const lineWords = target[field];
      if (!lineWords) return applied(root, []);
      const snapped = closeIntraGroupGaps(lineWords);
      if (snapped === lineWords) return applied(root, []);
      const lineUpdate = field === "backgroundWords" ? manualBackgroundWordEdit(snapped) : { [field]: snapped };
      return withLines(
        root,
        root.lines.map((line) => (line.id === lineId ? reconcileLine({ ...line, ...lineUpdate }) : line)),
      );
    },
  };
}

function markWordsExplicit(targets: ExplicitTarget[], value: boolean): LyricCommand {
  return {
    note: { command: "mark explicit", args: [targets.length, value ? 1 : 0] },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root) => withLines(root, applyMarkWordsExplicit(root.lines, targets, value)),
  };
}

function splitIdenticalSyllables({
  source,
  splitPoints,
  caseInsensitive,
}: {
  source: IdenticalMatchSource;
  splitPoints: number[];
  caseInsensitive: boolean;
}): LyricCommand {
  return {
    note: { command: "split identical", args: [source.lineId, source.type, source.wordIndex, ...splitPoints] },
    derivesText: true,
    copiesSharedTiming: true,
    run: (root) => {
      if (splitPoints.length === 0) return applied(root, []);
      return withLines(root, applySyllableSplitToLines(root.lines, source, splitPoints, caseInsensitive));
    },
  };
}

// -- Exports ------------------------------------------------------------------

export {
  applyWordCountChange,
  markWordsExplicit,
  mergeSyllableGroup,
  snapSyllablesFlush,
  splitIdenticalSyllables,
  toggleWordExplicit,
};
