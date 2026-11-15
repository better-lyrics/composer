import { editRows, shownWithRewrittenRows } from "@/domain/edit-text/background-ranges";
import { diffEditTextChange, withMovedTextDetached } from "@/domain/edit-text/diff-edit-text";
import { editTextWithRewrittenRows } from "@/domain/edit-text/edit-text";
import { type BackgroundRange, NO_RANGES } from "@/domain/edit-text/shown-row";
import type { LinkGroup } from "@/domain/group/template";
import type { InstanceAnchors } from "@/domain/group/template-copy";
import { type CarriedSplit, carryTemplateEdits } from "@/domain/group/template-edit";
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
  /** The split character the text was written with; the current one when left out. */
  splitCharacter?: string;
  /** Where the text shows background tracks inline; the text shows none when left out. */
  ranges?: readonly BackgroundRange[];
  /** Where each group instance sits, from the project's doc; read from the lines when left out. */
  anchors?: InstanceAnchors;
}

// -- Helpers ------------------------------------------------------------------

function typedLyricLines(
  text: string,
  ranges: readonly BackgroundRange[] | undefined,
  defaultAgentId: string,
  lines: LyricLine[],
  splitCharacter: string | undefined,
): LyricLine[] {
  if (!ranges) return textToLyricLines(text, defaultAgentId, lines, splitCharacter);
  const rows = editRows(text, ranges);
  const mainTexts = rows.map((row) => row.text);
  const backgrounds = rows.map((row) => row.background);
  return textToLyricLines(mainTexts, defaultAgentId, lines, splitCharacter, backgrounds);
}

function decideEditTextAction({
  text,
  defaultAgentId,
  lines,
  groups,
  splitCharacter,
  ranges,
  anchors,
}: DecideOptions): EditTextAction {
  const lyricLines = typedLyricLines(text, ranges, defaultAgentId, lines, splitCharacter);
  const diff = diffEditTextChange(lines, lyricLines);

  if (diff.hasStructuralChange) {
    const moved = withMovedTextDetached(lines, lyricLines);
    return {
      kind: "apply",
      finalLines: moved.lines,
      editText: text,
      editRanges: ranges ?? NO_RANGES,
      detachedIds: moved.detachedIds,
      removedIds: moved.removedIds,
      splits: [],
    };
  }

  if (diff.contentUpdates.length === 0) return { kind: "noop" };
  // The rows of other instances show the edit as the commit will write it.
  const { lines: finalLines, splits } = carryTemplateEdits({ before: lines, after: lyricLines, groups, anchors });
  if (!ranges) {
    const editText = editTextWithRewrittenRows(text, lyricLines, finalLines);
    return { kind: "apply", finalLines, editText, editRanges: NO_RANGES, detachedIds: [], removedIds: [], splits };
  }
  const shown = shownWithRewrittenRows({ text, ranges }, lyricLines, finalLines);
  return {
    kind: "apply",
    finalLines,
    editText: shown.text,
    editRanges: shown.ranges,
    detachedIds: [],
    removedIds: [],
    splits,
  };
}

// -- Exports ------------------------------------------------------------------

export { decideEditTextAction };
