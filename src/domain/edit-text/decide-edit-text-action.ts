import { editRows, shownWithRewrittenRows } from "@/domain/edit-text/background-ranges";
import {
  diffEditTextChange,
  findStructurallyImpactedInstances,
  type ImpactedInstance,
  propagateContentUpdates,
} from "@/domain/edit-text/diff-edit-text";
import { editTextWithRewrittenRows } from "@/domain/edit-text/edit-text";
import { type BackgroundRange, NO_RANGES } from "@/domain/edit-text/shown-row";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { textToLyricLines } from "@/utils/lyrics-text";

// -- Types --------------------------------------------------------------------

type EditTextAction =
  | { kind: "ignore-modal-pending" }
  | { kind: "noop" }
  | { kind: "apply"; finalLines: LyricLine[]; editText: string; editRanges: readonly BackgroundRange[] }
  | { kind: "needs-confirm"; lyricLines: LyricLine[]; impacted: ImpactedInstance[]; labels: string[] };

interface DecideOptions {
  text: string;
  defaultAgentId: string;
  lines: LyricLine[];
  groups: LinkGroup[];
  modalPending: boolean;
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

function uniqueImpactedLabels(impacted: ImpactedInstance[], groups: LinkGroup[]): string[] {
  const groupsById = new Map<string, LinkGroup>();
  for (const g of groups) groupsById.set(g.id, g);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of impacted) {
    const label = groupsById.get(i.groupId)?.label;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function decideEditTextAction({
  text,
  defaultAgentId,
  lines,
  groups,
  modalPending,
  splitCharacter,
  ranges,
}: DecideOptions): EditTextAction {
  if (modalPending) return { kind: "ignore-modal-pending" };

  const lyricLines = typedLyricLines(text, ranges, defaultAgentId, lines, splitCharacter);
  const diff = diffEditTextChange(lines, lyricLines);

  if (diff.hasStructuralChange) {
    const impacted = findStructurallyImpactedInstances(lines, lyricLines);
    if (impacted.length > 0) {
      return {
        kind: "needs-confirm",
        lyricLines,
        impacted,
        labels: uniqueImpactedLabels(impacted, groups),
      };
    }
    return { kind: "apply", finalLines: lyricLines, editText: text, editRanges: ranges ?? NO_RANGES };
  }

  if (diff.contentUpdates.length === 0) return { kind: "noop" };
  const finalLines = propagateContentUpdates(lines, lyricLines, diff.contentUpdates);
  if (!ranges) {
    const editText = editTextWithRewrittenRows(text, lyricLines, finalLines);
    return { kind: "apply", finalLines, editText, editRanges: NO_RANGES };
  }
  const shown = shownWithRewrittenRows({ text, ranges }, lyricLines, finalLines);
  return { kind: "apply", finalLines, editText: shown.text, editRanges: shown.ranges };
}

// -- Exports ------------------------------------------------------------------

export { decideEditTextAction };
