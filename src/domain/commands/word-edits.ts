import type { LyricCommand } from "@/domain/commands/command";
import { type LyricRoot, type Outcome, applied, refused, withLines } from "@/domain/commands/outcome";
import type { LineLanguages } from "insync/language";
import type { LyricLine } from "insync/line";
import { fieldWords, type TrackField } from "insync/line-track";
import {
  type ExplicitTarget,
  applyMarkWordsExplicit,
  applyMergeSyllableGroup,
  withFieldWords,
} from "insync/line-word-track-edits";
import { applySyllableSplitToLines } from "@/domain/word/identical-syllable-split";
import type { IdenticalMatchSource } from "insync/identical-word-matcher";
import { closeIntraGroupGaps, expandSelectionToGroupmates } from "insync/word-syllable-groups";
import type { WordTiming } from "insync/word-timing";

// -- Types --------------------------------------------------------------------

type WordField = TrackField;

// What a word write carries besides the words: the readings regrouped with them.
interface WordWriteExtras {
  languages?: LineLanguages;
}

// -- Helpers ------------------------------------------------------------------

function withWordWrite(
  line: LyricLine,
  field: WordField,
  words: WordTiming[],
  extras: WordWriteExtras,
  splitChar: string,
): LyricLine {
  const written = withFieldWords(line, field, words, splitChar);
  return "languages" in extras ? { ...written, languages: extras.languages } : written;
}

function wordWrite(
  root: LyricRoot,
  lineId: string,
  newWords: WordTiming[],
  field: WordField,
  extras: WordWriteExtras,
  splitChar: string,
): Outcome {
  if (!root.lines.some((line) => line.id === lineId)) return refused({ reason: "line-gone", lineId });
  return withLines(
    root,
    root.lines.map((line) => (line.id === lineId ? withWordWrite(line, field, newWords, extras, splitChar) : line)),
  );
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

function toggleWordExplicit(lineId: string, field: WordField, wordIndices: readonly number[]): LyricCommand {
  return {
    note: { command: "toggle explicit", args: [lineId, field, ...wordIndices] },
    copiesSharedTiming: true,
    run: (root, ctx) => {
      if (wordIndices.length === 0) return applied(root, []);
      const target = root.lines.find((line) => line.id === lineId);
      if (!target) return refused({ reason: "line-gone", lineId });
      const currentWords = fieldWords(target, field);
      if (!currentWords || currentWords.length === 0) return applied(root, []);
      const newWords = toggledExplicitWords(currentWords, wordIndices);
      if (!newWords) return applied(root, []);
      return wordWrite(root, lineId, newWords, field, {}, ctx.splitChar);
    },
  };
}

function mergeSyllableGroup(lineId: string, field: WordField, wordIndices: number[]): LyricCommand {
  return {
    note: { command: "merge syllables", args: [lineId, field, ...wordIndices] },
    copiesSharedTiming: true,
    run: (root, ctx) => withLines(root, applyMergeSyllableGroup(root.lines, lineId, field, wordIndices, ctx.splitChar)),
  };
}

function snapSyllablesFlush(lineId: string, field: WordField): LyricCommand {
  return {
    note: { command: "snap syllables", args: [lineId, field] },
    copiesSharedTiming: true,
    run: (root, ctx) => {
      const target = root.lines.find((line) => line.id === lineId);
      if (!target) return refused({ reason: "line-gone", lineId });
      const lineWords = fieldWords(target, field);
      if (!lineWords) return applied(root, []);
      const snapped = closeIntraGroupGaps(lineWords);
      if (snapped === lineWords) return applied(root, []);
      return withLines(
        root,
        root.lines.map((line) => (line.id === lineId ? withFieldWords(line, field, snapped, ctx.splitChar) : line)),
      );
    },
  };
}

function markWordsExplicit(targets: ExplicitTarget[], value: boolean): LyricCommand {
  return {
    note: { command: "mark explicit", args: [targets.length, value ? 1 : 0] },
    copiesSharedTiming: false,
    run: (root, ctx) => withLines(root, applyMarkWordsExplicit(root.lines, targets, value, ctx.splitChar)),
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
    run: (root, ctx) => {
      if (splitPoints.length === 0) return applied(root, []);
      return withLines(
        root,
        applySyllableSplitToLines(root.lines, source, splitPoints, caseInsensitive, ctx.splitChar),
      );
    },
  };
}

// -- Exports ------------------------------------------------------------------

export type { WordWriteExtras };
export { markWordsExplicit, mergeSyllableGroup, snapSyllablesFlush, splitIdenticalSyllables, toggleWordExplicit };
