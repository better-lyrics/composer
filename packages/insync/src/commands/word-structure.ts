import type { LyricCommand } from "./command";
import { lineEditCommand } from "./line-edits";
import { refused, withLines } from "./outcome";
import type { WordWriteExtras } from "./word-edits";
import { withBackground, withSeededBackground, withoutBackground } from "../line-background";
import { drawnSyllables } from "../line-drawn-track";
import { mainWordsEdit, manualBackgroundWordEdit } from "../line-lane-word-edits";
import type { LyricLine } from "../line";
import { syllablesText } from "../line-text";
import {
  backgroundTrack,
  isSpanTimed,
  mainTrack,
  type TrackField,
  type WordTrack,
  untimedSyllablesOf,
  trackRole,
} from "../line-track";
import { withBackgroundTrack, withMainTrack, withTrackText } from "../line-track-writes";
import { withFieldWords } from "../line-word-track-edits";
import type { SyllableAddress } from "../selection-model";
import { resolveAddresses } from "../selection-resolve";
import { applyWordDeletion } from "../word-apply-word-deletion";
import { mergeWordsIntoTrack } from "../word-merge-track";
import type { WordTiming } from "../word-timing";
import { withTypedBoundaries } from "../word-typed-boundaries";

// -- Types --------------------------------------------------------------------

type TrackFill =
  | { lineId: string; type: WordTrack; timedText: WordTiming[] }
  | { lineId: string; type: WordTrack; placeholder: WordTiming };

// -- Helpers ------------------------------------------------------------------

function trackWrite(line: LyricLine, type: WordTrack, words: WordTiming[], splitChar: string): Partial<LyricLine> {
  return type === "word" ? mainWordsEdit(line, words) : manualBackgroundWordEdit(line, words, splitChar);
}

// A line-synced track keeps its span and takes the drawn block's text; a renamed background is the user's own.
function wordTextEdit(line: LyricLine, type: WordTrack, words: WordTiming[], splitChar: string): Partial<LyricLine> {
  const track = type === "word" ? mainTrack(line) : backgroundTrack(line);
  if (!track || !isSpanTimed(track)) return trackWrite(line, type, words, splitChar);
  const text = withTrackText(track, syllablesText(words, splitChar), splitChar);
  if (text.role === "main") return { tracks: withMainTrack(line, text).tracks };
  return { tracks: withBackgroundTrack(line, { ...text, source: "manual" }).tracks };
}

function lineOf(lines: readonly LyricLine[], lineId: string): LyricLine | undefined {
  return lines.find((line) => line.id === lineId);
}

// -- Commands -----------------------------------------------------------------

function deleteWords(addresses: readonly SyllableAddress[]): LyricCommand {
  return {
    note: { command: "delete words", args: addresses.map((address) => address.syllableId) },
    copiesSharedTiming: false,
    run: (root, ctx) =>
      withLines(
        root,
        applyWordDeletion(root.lines, resolveAddresses(root.lines, addresses, ctx.splitChar), ctx.splitChar),
      ),
  };
}

// Typed text replaces one word's text; its timing and its place stay.
function typeWordText(address: SyllableAddress, text: string): LyricCommand {
  return lineEditCommand(
    { command: "type word", args: [address.lineId, address.type, address.syllableId, text] },
    (root, ctx) => {
      const line = lineOf(root.lines, address.lineId);
      const words = line && drawnSyllables(line, trackRole(address.type), ctx.splitChar);
      const wordIndex = words?.findIndex((word) => word.id === address.syllableId) ?? -1;
      if (!line || !words || wordIndex === -1) return refused({ reason: "word-gone", address });
      const word = words[wordIndex];
      if (text === word.text) return [];
      const updated = withTypedBoundaries(
        words.with(wordIndex, { ...word, text, sep: word.sep.endsWith(" ") ? " " : "" }),
        ctx.splitChar,
      );
      return [{ id: line.id, updates: wordTextEdit(line, address.type, updated, ctx.splitChar) }];
    },
  );
}

// A new word dropped into a free slot of a track.
function insertWord(lineId: string, type: WordTrack, word: WordTiming): LyricCommand {
  return lineEditCommand({ command: "insert word", args: [lineId, type, word.id, word.begin] }, (root, ctx) => {
    const raw = lineOf(root.lines, lineId);
    if (!raw) return refused({ reason: "line-gone", lineId });
    const words = drawnSyllables(raw, trackRole(type), ctx.splitChar);
    return [
      {
        id: lineId,
        updates: trackWrite(
          raw,
          type,
          mergeWordsIntoTrack(words, [word], untimedSyllablesOf(raw, trackRole(type))),
          ctx.splitChar,
        ),
      },
    ];
  });
}

// An empty track takes the line's own text timed from a point, or one placeholder word to type into.
function fillEmptyTrack(fill: TrackFill): LyricCommand {
  return lineEditCommand({ command: "fill track", args: [fill.lineId, fill.type] }, (root, ctx) => {
    const line = lineOf(root.lines, fill.lineId);
    if (!line) return refused({ reason: "line-gone", lineId: fill.lineId });
    const words = "timedText" in fill ? fill.timedText : [fill.placeholder];
    return [{ id: fill.lineId, updates: trackWrite(line, fill.type, words, ctx.splitChar) }];
  });
}

function setBackgroundText(lineId: string, text: string): LyricCommand {
  return lineEditCommand({ command: "set background text", args: [lineId, text] }, (root, ctx) => {
    const line = lineOf(root.lines, lineId);
    if (!line) return refused({ reason: "line-gone", lineId });
    const written = withSeededBackground(
      withBackground(line, { text, source: "manual" }, ctx.splitChar),
      ctx.splitChar,
    );
    return [{ id: lineId, updates: { tracks: written.tracks } }];
  });
}

function clearBackground(lineId: string): LyricCommand {
  return lineEditCommand({ command: "clear background", args: [lineId] }, (root) => {
    const line = lineOf(root.lines, lineId);
    return line
      ? [{ id: lineId, updates: { tracks: withoutBackground(line).tracks } }]
      : refused({ reason: "line-gone", lineId });
  });
}

// A split that keeps the word count on a line, or one with no linked copies to follow it.
function splitWord(lineId: string, field: TrackField, words: WordTiming[], extras: WordWriteExtras): LyricCommand {
  return lineEditCommand({ command: "split word", args: [lineId, field, words.length] }, (root, ctx) => {
    const line = lineOf(root.lines, lineId);
    if (!line) return refused({ reason: "line-gone", lineId });
    return [
      {
        id: lineId,
        updates: {
          ...extras,
          tracks: withFieldWords(line, field, withTypedBoundaries(words, ctx.splitChar), ctx.splitChar).tracks,
        },
      },
    ];
  });
}

// -- Exports ------------------------------------------------------------------

export { clearBackground, deleteWords, fillEmptyTrack, insertWord, setBackgroundText, splitWord, typeWordText };
