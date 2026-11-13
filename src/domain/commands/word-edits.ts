import type { LyricCommand } from "@/domain/commands/command";
import { type LyricRoot, type Outcome, applied, refused, withLines } from "@/domain/commands/outcome";
import { getLinkScope, isLinkedSibling, unlinkLines } from "@/domain/group/linking";
import { withOwnPieces } from "@/domain/language/pieces";
import type { LineLanguages } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";
import { fieldWords, type TrackField } from "@/domain/line/track";
import {
  type ExplicitTarget,
  applyMarkWordsExplicit,
  applyMergeSyllableGroup,
  withFieldWords,
} from "@/domain/line/word-track-edits";
import { applySyllableSplitToLines } from "@/domain/word/identical-syllable-split";
import type { IdenticalMatchSource } from "@/utils/identical-word-matcher";
import { closeIntraGroupGaps, expandSelectionToGroupmates } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { applySiblingWords } from "@/utils/word-diff";

// -- Types --------------------------------------------------------------------

type WordField = TrackField;

// What a word write carries besides the words: the readings regrouped with them.
interface WordWriteExtras {
  languages?: LineLanguages;
}
type WordCountResolution = "apply" | "detach" | "cancel";

// -- Helpers ------------------------------------------------------------------

function withWordWrite(line: LyricLine, field: WordField, words: WordTiming[], extras: WordWriteExtras): LyricLine {
  const written = withFieldWords(line, field, words);
  return "languages" in extras ? { ...written, languages: extras.languages } : written;
}

function wordCountChange(
  root: LyricRoot,
  lineId: string,
  newWords: WordTiming[],
  field: WordField,
  resolution: WordCountResolution,
  extras: WordWriteExtras,
): Outcome {
  if (resolution === "cancel") return applied(root, []);
  const target = root.lines.find((line) => line.id === lineId);
  if (!target) return refused({ reason: "line-gone", lineId });

  if (resolution === "detach") {
    const edited = root.lines.map((line) => (line.id === lineId ? withWordWrite(line, field, newWords, extras) : line));
    return withLines(
      root,
      unlinkLines(edited, (line) => line.id === lineId),
    );
  }

  const sourceBefore = fieldWords(target, field);
  const linkScope = getLinkScope(target);
  const lines = root.lines.map((line) => {
    if (line.id === lineId) return withWordWrite(line, field, newWords, extras);
    if (!isLinkedSibling(line, linkScope)) return line;
    const propagated = applySiblingWords(newWords, sourceBefore, fieldWords(line, field));
    const withLanguages = "languages" in extras ? { ...line, languages: withOwnPieces(extras.languages, line) } : line;
    return propagated ? withFieldWords(withLanguages, field, propagated) : withLanguages;
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
  extras: WordWriteExtras = {},
): LyricCommand {
  return {
    note: { command: "change word count", args: [lineId, field, resolution] },
    copiesSharedTiming: true,
    run: (root) => wordCountChange(root, lineId, newWords, field, resolution, extras),
  };
}

function toggleWordExplicit(lineId: string, field: WordField, wordIndices: readonly number[]): LyricCommand {
  return {
    note: { command: "toggle explicit", args: [lineId, field, ...wordIndices] },
    copiesSharedTiming: true,
    run: (root) => {
      if (wordIndices.length === 0) return applied(root, []);
      const target = root.lines.find((line) => line.id === lineId);
      if (!target) return refused({ reason: "line-gone", lineId });
      const currentWords = fieldWords(target, field);
      if (!currentWords || currentWords.length === 0) return applied(root, []);
      const newWords = toggledExplicitWords(currentWords, wordIndices);
      if (!newWords) return applied(root, []);
      return wordCountChange(root, lineId, newWords, field, "apply", {});
    },
  };
}

function mergeSyllableGroup(lineId: string, field: WordField, wordIndices: number[]): LyricCommand {
  return {
    note: { command: "merge syllables", args: [lineId, field, ...wordIndices] },
    copiesSharedTiming: true,
    run: (root) => withLines(root, applyMergeSyllableGroup(root.lines, lineId, field, wordIndices)),
  };
}

function snapSyllablesFlush(lineId: string, field: WordField): LyricCommand {
  return {
    note: { command: "snap syllables", args: [lineId, field] },
    copiesSharedTiming: true,
    run: (root) => {
      const target = root.lines.find((line) => line.id === lineId);
      if (!target) return refused({ reason: "line-gone", lineId });
      const lineWords = fieldWords(target, field);
      if (!lineWords) return applied(root, []);
      const snapped = closeIntraGroupGaps(lineWords);
      if (snapped === lineWords) return applied(root, []);
      return withLines(
        root,
        root.lines.map((line) => (line.id === lineId ? withFieldWords(line, field, snapped) : line)),
      );
    },
  };
}

function markWordsExplicit(targets: ExplicitTarget[], value: boolean): LyricCommand {
  return {
    note: { command: "mark explicit", args: [targets.length, value ? 1 : 0] },
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
    copiesSharedTiming: true,
    run: (root) => {
      if (splitPoints.length === 0) return applied(root, []);
      return withLines(root, applySyllableSplitToLines(root.lines, source, splitPoints, caseInsensitive));
    },
  };
}

// -- Exports ------------------------------------------------------------------

export type { WordWriteExtras };
export {
  applyWordCountChange,
  markWordsExplicit,
  mergeSyllableGroup,
  snapSyllablesFlush,
  splitIdenticalSyllables,
  toggleWordExplicit,
};
