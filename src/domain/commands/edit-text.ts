import type { HistoryNote, LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { type LyricRoot, type Refusal, applied, refused } from "@/domain/commands/outcome";
import { decideEditTextAction } from "@/domain/edit-text/decide-edit-text-action";
import { detachInstancesFromLines } from "@/domain/edit-text/diff-edit-text";
import type { LinkGroup } from "@/domain/group/template";
import { isLinked } from "@/domain/instance/predicates";
import { withBackground, withSeededBackground, withoutBackground } from "@/domain/line/background";
import type { RawLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { backgroundTrack, timedSyllables } from "@/domain/line/track";
import { isSectionTagLine } from "@/domain/lyrics-file/genius-text";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";
import {
  type ExtractOptions,
  extractBackgroundVocals,
  extractInlineAcrossLinkedLines,
} from "@/utils/background-vocal-extraction";

// -- Types --------------------------------------------------------------------

interface WholeLines {
  lines: RawLine[];
  groups?: LinkGroup[];
}

// -- Helpers ------------------------------------------------------------------

function sameLines(before: readonly RawLine[], after: readonly RawLine[]): boolean {
  return before.length === after.length && after.every((line, index) => line === before[index]);
}

// Edit rewrites the whole lyrics; lines that come back unchanged write nothing.
function wholeLinesEdit(
  note: HistoryNote,
  next: (root: LyricRoot) => WholeLines | { refused: Refusal } | null,
): LyricCommand {
  return {
    note,
    copiesSharedTiming: false,
    run: (root) => {
      const edited = next(root);
      if (!edited) return applied(root, []);
      if ("refused" in edited) return edited;
      const groups = edited.groups ?? root.groups;
      if (sameLines(root.lines, edited.lines) && groups === root.groups) return applied(root, []);
      // Whole-text edits never run the shared timing copy, the only reader of touched ids, so skip the per-keystroke scan.
      return applied({ ...root, lines: edited.lines, groups }, []);
    },
  };
}

// A plan made on other lyrics never lands on these.
function planOn(baseLines: readonly RawLine[], lines: RawLine[]) {
  return (root: LyricRoot) => (root.lines === baseLines ? { lines } : refused({ reason: "lyrics-changed" }));
}

// -- Commands -----------------------------------------------------------------

// One keystroke of a typing burst.
function typeLyrics(baseLines: readonly RawLine[], lines: RawLine[]): LyricCommand {
  return wholeLinesEdit({ command: "type lyrics", args: [lines.length] }, planOn(baseLines, lines));
}

function pasteLyrics(baseLines: readonly RawLine[], lines: RawLine[]): LyricCommand {
  return wholeLinesEdit({ command: "paste lyrics", args: [lines.length] }, planOn(baseLines, lines));
}

// Decided again after the detach prompt, so lyrics that changed while it was open are not overwritten.
function applyEditTextDetaching(text: string, defaultAgentId: string, splitCharacter?: string): LyricCommand {
  return wholeLinesEdit({ command: "detach and apply text", args: [] }, (root) => {
    const action = decideEditTextAction({
      text,
      defaultAgentId,
      lines: root.lines,
      groups: root.groups,
      modalPending: false,
      splitCharacter,
    });
    if (action.kind === "apply") return { lines: action.finalLines };
    if (action.kind !== "needs-confirm") return null;
    const lines = detachInstancesFromLines(action.lyricLines, action.impacted);
    const remainingGroupIds = new Set(lines.flatMap((line) => (line.groupId ? [line.groupId] : [])));
    return { lines, groups: root.groups.filter((group) => remainingGroupIds.has(group.id)) };
  });
}

function extractBackground(options: ExtractOptions): LyricCommand {
  return wholeLinesEdit({ command: "extract background", args: [] }, (root) => ({
    lines: extractBackgroundVocals(root.lines, options),
  }));
}

function removeSectionTagLines(lineIds: ReadonlySet<string>): LyricCommand {
  return wholeLinesEdit({ command: "remove section tags", args: [...lineIds] }, (root) => ({
    lines: root.lines.filter((line) => !(lineIds.has(line.id) && isSectionTagLine(lineText(line)) && !isLinked(line))),
  }));
}

function extractLineBackground(lineId: string, preserveBrackets: boolean): LyricCommand {
  return lineEditCommand(
    { command: "extract line background", args: [lineId] },
    (root) => extractInlineAcrossLinkedLines(root.lines, lineId, { mergeStandaloneLines: false, preserveBrackets }),
    { propagateToSiblings: false },
  );
}

// Retyped background words keep their timing; a new background is seeded.
function editBackgroundText(lineId: string, text: string): LyricCommand {
  return lineEditCommand({ command: "edit background text", args: [lineId, text] }, (root) => {
    const target = root.lines.find((line) => line.id === lineId);
    if (!target) return refused({ reason: "line-gone", lineId });
    const timed = timedSyllables(backgroundTrack(target));
    const edited = !text
      ? withoutBackground(target)
      : timed.length > 0
        ? withBackground(target, { text, words: remapWordTextsPreservingTiming(timed, text), source: "manual" })
        : withSeededBackground(withBackground(target, { text, source: "manual" }));
    return [{ id: lineId, updates: { tracks: edited.tracks } }];
  });
}

// -- Exports ------------------------------------------------------------------

export {
  applyEditTextDetaching,
  editBackgroundText,
  extractBackground,
  extractLineBackground,
  pasteLyrics,
  removeSectionTagLines,
  typeLyrics,
};
