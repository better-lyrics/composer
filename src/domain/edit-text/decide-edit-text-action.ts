import { editRows, shownWithRewrittenRows } from "@/domain/edit-text/background-ranges";
import { diffEditTextChange, withMovedTextDetached } from "insync/edit-text-diff-edit-text";
import { editTextWithRewrittenRows } from "insync/edit-text";
import { type BackgroundRange, NO_RANGES, type ShownEditText } from "insync/edit-text-shown-row";
import type { LinkGroup } from "insync/group";
import type { InstanceAnchors } from "insync/group-template-copy";
import { type CarriedSplit, carryTemplateEdits } from "insync/group-template-edit";
import type { LyricLine } from "insync/line";
import { textToLyricLines } from "@/utils/lyrics-text";

// -- Types --------------------------------------------------------------------

type EditTextAction =
  | { kind: "noop" }
  | {
      kind: "apply";
      finalLines: LyricLine[];
      editText: string;
      editRanges: readonly BackgroundRange[];
      // Group lines the edit made their instance's own, and ones it removed from their instance.
      detachedIds: readonly string[];
      removedIds: readonly string[];
      // Splits the edit carried to other instances of a group.
      splits: readonly CarriedSplit[];
    };

interface DecideOptions {
  text: string;
  defaultAgentId: string;
  lines: LyricLine[];
  groups: LinkGroup[];
  /** The split character the text was written with. */
  splitCharacter: string;
  /** Where the text shows background tracks inline; the text shows none when left out. */
  ranges?: readonly BackgroundRange[];
  /** Where each group instance sits, from the project's doc; read from the lines when left out. */
  anchors?: InstanceAnchors;
  /** Where the song ends; unbounded when left out. */
  songEnd?: number;
  /** The lines when the current run of typing began. */
  runStartLines?: readonly LyricLine[];
}

// -- Helpers ------------------------------------------------------------------

function typedLyricLines(
  text: string,
  ranges: readonly BackgroundRange[] | undefined,
  defaultAgentId: string,
  lines: LyricLine[],
  splitCharacter: string,
  songEnd: number | undefined,
): LyricLine[] {
  if (!ranges) return textToLyricLines(text, defaultAgentId, lines, splitCharacter);
  const rows = editRows(text, ranges);
  const mainTexts = rows.map((row) => row.text);
  const backgrounds = rows.map((row) => row.background);
  return textToLyricLines(mainTexts, defaultAgentId, lines, splitCharacter, backgrounds, songEnd);
}

// A structural commit rewrites only the rows that no longer show a line the project held before it.
function linesAlreadyHeld(lines: readonly LyricLine[], finalLines: readonly LyricLine[]): (LyricLine | undefined)[] {
  const held = new Set(lines);
  return finalLines.map((line) => (held.has(line) ? line : undefined));
}

// Rows the user typed stay as typed; only rows the commit rewrote show the committed line.
function rewrittenEditText(
  text: string,
  ranges: readonly BackgroundRange[] | undefined,
  typedLines: readonly (LyricLine | undefined)[],
  finalLines: readonly LyricLine[],
  splitCharacter: string,
): ShownEditText {
  if (ranges) return shownWithRewrittenRows({ text, ranges }, typedLines, finalLines, splitCharacter);
  return { text: editTextWithRewrittenRows(text, typedLines, finalLines, splitCharacter), ranges: NO_RANGES };
}

function decideEditTextAction({
  text,
  defaultAgentId,
  lines,
  groups,
  splitCharacter,
  ranges,
  anchors,
  songEnd,
  runStartLines,
}: DecideOptions): EditTextAction {
  const lyricLines = typedLyricLines(text, ranges, defaultAgentId, lines, splitCharacter, songEnd);
  const diff = diffEditTextChange(lines, lyricLines);

  if (diff.hasStructuralChange) {
    const runStart = runStartLines && { lines: runStartLines, splitChar: splitCharacter };
    const moved = withMovedTextDetached(lines, lyricLines, runStart);
    const finalLines = moved.restoredIds.length
      ? carryTemplateEdits({ before: lines, after: moved.lines, groups, anchors, splitChar: splitCharacter, songEnd })
          .lines
      : moved.lines;
    // A break that takes lines out of their instance or back to the run's start commits them, so the text shows them
    // as committed.
    const leftInstance = moved.detachedIds.length > 0 || moved.removedIds.length > 0 || moved.restoredIds.length > 0;
    const shown = leftInstance
      ? rewrittenEditText(text, ranges, linesAlreadyHeld(lines, finalLines), finalLines, splitCharacter)
      : { text, ranges: ranges ?? NO_RANGES };
    return {
      kind: "apply",
      finalLines,
      editText: shown.text,
      editRanges: shown.ranges,
      detachedIds: moved.detachedIds,
      removedIds: moved.removedIds,
      splits: [],
    };
  }

  if (diff.contentUpdates.length === 0) return { kind: "noop" };
  // The rows of other instances show the edit as the commit will write it.
  const {
    lines: finalLines,
    splits,
    detachedIds,
  } = carryTemplateEdits({
    before: lines,
    after: lyricLines,
    groups,
    anchors,
    splitChar: splitCharacter,
    songEnd,
  });
  const shown = rewrittenEditText(text, ranges, lyricLines, finalLines, splitCharacter);
  return {
    kind: "apply",
    finalLines,
    editText: shown.text,
    editRanges: shown.ranges,
    detachedIds,
    removedIds: [],
    splits,
  };
}

// -- Exports ------------------------------------------------------------------

export { decideEditTextAction };
