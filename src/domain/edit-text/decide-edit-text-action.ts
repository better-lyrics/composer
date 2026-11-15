import { editRows, shownWithRewrittenRows } from "@/domain/edit-text/background-ranges";
import { diffEditTextChange, withMovedTextDetached } from "@/domain/edit-text/diff-edit-text";
import { editTextWithRewrittenRows } from "@/domain/edit-text/edit-text";
import { type BackgroundRange, NO_RANGES } from "@/domain/edit-text/shown-row";
import type { LinkGroup } from "@/domain/group/template";
import { carryTemplateEdits } from "@/domain/group/template-edit";
import type { LyricLine } from "@/domain/line/model";
import { textToLyricLines } from "@/utils/lyrics-text";

// -- Types --------------------------------------------------------------------

type EditTextAction =
  | { kind: "noop" }
  | {
      kind: "apply";
      finalLines: LyricLine[];
      editText: string;
      editRanges: readonly BackgroundRange[];
      // Group lines the edit made their instance's own.
      detachedIds: readonly string[];
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
    };
  }

  if (diff.contentUpdates.length === 0) return { kind: "noop" };
  // The rows of other instances show the edit as the commit will write it.
  const finalLines = carryTemplateEdits({ before: lines, after: lyricLines, groups }).lines;
  if (!ranges) {
    const editText = editTextWithRewrittenRows(text, lyricLines, finalLines);
    return { kind: "apply", finalLines, editText, editRanges: NO_RANGES, detachedIds: [] };
  }
  const shown = shownWithRewrittenRows({ text, ranges }, lyricLines, finalLines);
  return { kind: "apply", finalLines, editText: shown.text, editRanges: shown.ranges, detachedIds: [] };
}

// -- Exports ------------------------------------------------------------------

export { decideEditTextAction };
