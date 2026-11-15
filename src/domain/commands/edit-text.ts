import type { LyricLine } from "insync/line";
import type { CommandContext, HistoryNote, LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { type LyricRoot, type Refusal, applied, refused } from "@/domain/commands/outcome";
import type { LinkGroup } from "insync/group";
import { isLinked } from "insync/instance-predicates";
import { withBackground, withSeededBackground, withoutBackground } from "insync/line-background";
import { lineText } from "insync/line-text";
import { backgroundTrack, isSpanTimed, timedSyllables } from "insync/line-track";
import { withBackgroundTrack, withTrackText } from "insync/line-track-writes";
import { isSectionTagLine } from "insync/lyrics-file-genius-text";
import { remapWordTextsPreservingTiming } from "insync/word-remap-text";
import { type ExtractOptions, extractBackgroundVocals, extractInlineOnLine } from "@/utils/background-vocal-extraction";

// -- Types --------------------------------------------------------------------

interface WholeLines {
  lines: LyricLine[];
  groups?: LinkGroup[];
}

// -- Helpers ------------------------------------------------------------------

function sameLines(before: readonly LyricLine[], after: readonly LyricLine[]): boolean {
  return before.length === after.length && after.every((line, index) => line === before[index]);
}

// Edit rewrites the whole lyrics; lines that come back unchanged write nothing.
function wholeLinesEdit(
  note: HistoryNote,
  next: (root: LyricRoot, ctx: CommandContext) => WholeLines | { refused: Refusal } | null,
  writesEveryLine = false,
): LyricCommand {
  return {
    note,
    copiesSharedTiming: false,
    ...(writesEveryLine && { writesEveryLine }),
    run: (root, ctx) => {
      const edited = next(root, ctx);
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
function planOn(baseLines: readonly LyricLine[], lines: LyricLine[]) {
  return (root: LyricRoot) => (root.lines === baseLines ? { lines } : refused({ reason: "lyrics-changed" }));
}

// -- Commands -----------------------------------------------------------------

// One keystroke of a typing burst. Edit plans its lines with the template edit already carried to every instance.
function typeLyrics(baseLines: readonly LyricLine[], lines: LyricLine[]): LyricCommand {
  return wholeLinesEdit({ command: "type lyrics", args: [lines.length] }, planOn(baseLines, lines), true);
}

function pasteLyrics(baseLines: readonly LyricLine[], lines: LyricLine[]): LyricCommand {
  return wholeLinesEdit({ command: "paste lyrics", args: [lines.length] }, planOn(baseLines, lines), true);
}

function extractBackground(options: ExtractOptions): LyricCommand {
  return wholeLinesEdit({ command: "extract background", args: [] }, (root, ctx) => ({
    lines: extractBackgroundVocals(root.lines, options, ctx.splitChar),
  }));
}

function removeSectionTagLines(lineIds: ReadonlySet<string>): LyricCommand {
  return wholeLinesEdit({ command: "remove section tags", args: [...lineIds] }, (root, ctx) => ({
    lines: root.lines.filter(
      (line) => !(lineIds.has(line.id) && isSectionTagLine(lineText(line, ctx.splitChar)) && !isLinked(line)),
    ),
  }));
}

function extractLineBackground(lineId: string, preserveBrackets: boolean): LyricCommand {
  return lineEditCommand({ command: "extract line background", args: [lineId] }, (root, ctx) =>
    extractInlineOnLine(root.lines, lineId, { mergeStandaloneLines: false, preserveBrackets }, ctx.splitChar),
  );
}

// Retyped background words keep their timing, a line-synced background keeps its span; a new background is seeded.
function editBackgroundText(lineId: string, text: string): LyricCommand {
  return lineEditCommand({ command: "edit background text", args: [lineId, text] }, (root, ctx) => {
    const target = root.lines.find((line) => line.id === lineId);
    if (!target) return refused({ reason: "line-gone", lineId });
    const background = backgroundTrack(target);
    const timed = timedSyllables(background);
    const edited = !text
      ? withoutBackground(target)
      : background && isSpanTimed(background)
        ? withBackgroundTrack(target, { ...withTrackText(background, text, ctx.splitChar), source: "manual" })
        : timed.length > 0
          ? withBackground(
              target,
              { text, words: remapWordTextsPreservingTiming(timed, text, ctx.splitChar), source: "manual" },
              ctx.splitChar,
            )
          : withSeededBackground(withBackground(target, { text, source: "manual" }, ctx.splitChar), ctx.splitChar);
    return [{ id: lineId, updates: { tracks: edited.tracks } }];
  });
}

// -- Exports ------------------------------------------------------------------

export { editBackgroundText, extractBackground, extractLineBackground, pasteLyrics, removeSectionTagLines, typeLyrics };
