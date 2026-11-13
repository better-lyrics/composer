import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused, withLines } from "@/domain/commands/outcome";
import {
  CLEARED_BACKGROUND,
  backgroundFields,
  manualBackgroundWordEdit,
  withSeededBackground,
} from "@/domain/line/background";
import { effectiveWordTextEdit, getEffectiveLine } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { type TrackField, type WordTrack, trackWords } from "@/domain/line/tracks";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveAddresses } from "@/domain/selection/resolve";
import { applyWordDeletion } from "@/domain/word/apply-word-deletion";
import { mergeWordsIntoTrack } from "@/domain/word/merge-track";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type TrackFill =
  | { lineId: string; type: WordTrack; timedText: WordTiming[] }
  | { lineId: string; type: WordTrack; placeholder: WordTiming };

// -- Helpers ------------------------------------------------------------------

function trackWrite(type: WordTrack, words: WordTiming[]): Partial<LyricLine> {
  return type === "word" ? { words } : manualBackgroundWordEdit(words);
}

function placeholderWrite(type: WordTrack, placeholder: WordTiming): Partial<LyricLine> {
  if (type === "word") return { words: [placeholder] };
  return backgroundFields({ text: placeholder.text, words: [placeholder], source: "manual" });
}

function lineOf(lines: readonly LyricLine[], lineId: string): LyricLine | undefined {
  return lines.find((line) => line.id === lineId);
}

// -- Commands -----------------------------------------------------------------

function deleteWords(addresses: readonly SyllableAddress[]): LyricCommand {
  return {
    note: { command: "delete words", args: addresses.map((address) => address.syllableId) },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root) => withLines(root, applyWordDeletion(root.lines, resolveAddresses(root.lines, addresses))),
  };
}

// Typed text replaces one word's text; its timing and its place stay.
function typeWordText(address: SyllableAddress, text: string): LyricCommand {
  return lineEditCommand(
    { command: "type word", args: [address.lineId, address.type, address.syllableId, text] },
    (root) => {
      const raw = lineOf(root.lines, address.lineId);
      const line = raw && getEffectiveLine(raw);
      const words = line && trackWords(line, address.type);
      const wordIndex = words?.findIndex((word) => word.id === address.syllableId) ?? -1;
      if (!line || !words || wordIndex === -1) return refused({ reason: "word-gone", address });
      const word = words[wordIndex];
      if (text === word.text) return [];
      const updated = words.with(wordIndex, { ...word, text, sep: word.sep.endsWith(" ") ? " " : "" });
      const updates =
        address.type === "word" ? effectiveWordTextEdit(line, updated) : manualBackgroundWordEdit(updated);
      return [{ id: line.id, updates }];
    },
  );
}

// A new word dropped into a free slot of a track.
function insertWord(lineId: string, type: WordTrack, word: WordTiming): LyricCommand {
  return lineEditCommand({ command: "insert word", args: [lineId, type, word.id, word.begin] }, (root) => {
    const raw = lineOf(root.lines, lineId);
    if (!raw) return refused({ reason: "line-gone", lineId });
    const words = trackWords(getEffectiveLine(raw), type) ?? [];
    return [{ id: lineId, updates: trackWrite(type, mergeWordsIntoTrack(words, [word])) }];
  });
}

// An empty track takes the line's own text timed from a point, or one placeholder word to type into.
function fillEmptyTrack(fill: TrackFill): LyricCommand {
  return lineEditCommand({ command: "fill track", args: [fill.lineId, fill.type] }, (root) => {
    if (!lineOf(root.lines, fill.lineId)) return refused({ reason: "line-gone", lineId: fill.lineId });
    const updates =
      "timedText" in fill ? trackWrite(fill.type, fill.timedText) : placeholderWrite(fill.type, fill.placeholder);
    return [{ id: fill.lineId, updates }];
  });
}

function setBackgroundText(lineId: string, text: string): LyricCommand {
  return lineEditCommand({ command: "set background text", args: [lineId, text] }, (root) => {
    const line = lineOf(root.lines, lineId);
    if (!line) return refused({ reason: "line-gone", lineId });
    const words = withSeededBackground({ ...line, backgroundText: text, backgroundWords: undefined }).backgroundWords;
    return [{ id: lineId, updates: backgroundFields({ text, words, source: "manual" }) }];
  });
}

function clearBackground(lineId: string): LyricCommand {
  return lineEditCommand({ command: "clear background", args: [lineId] }, (root) =>
    lineOf(root.lines, lineId)
      ? [{ id: lineId, updates: CLEARED_BACKGROUND }]
      : refused({ reason: "line-gone", lineId }),
  );
}

// A split that keeps the word count on a line, or one with no linked copies to follow it.
function splitWord(
  lineId: string,
  field: TrackField,
  words: WordTiming[],
  extraUpdates: Partial<LyricLine>,
): LyricCommand {
  return lineEditCommand({ command: "split word", args: [lineId, field, words.length] }, (root) =>
    lineOf(root.lines, lineId)
      ? [{ id: lineId, updates: { ...extraUpdates, [field]: words } }]
      : refused({ reason: "line-gone", lineId }),
  );
}

// -- Exports ------------------------------------------------------------------

export type { TrackFill };
export { clearBackground, deleteWords, fillEmptyTrack, insertWord, setBackgroundText, splitWord, typeWordText };
