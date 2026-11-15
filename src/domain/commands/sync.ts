import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";
import { timeRangeResolver } from "insync/group-shared-timing";
import type { PositionalPieces } from "insync/language-pieces";
import { splitWordsKeepingTransliteration } from "insync/language-reconcile-syllable-split";
import { effectiveBounds } from "insync/line-bounds";
import type { LyricLine } from "insync/line";
import { shiftLineTiming } from "insync/line-shift";
import { withRoleWords, withoutLineTiming } from "insync/line-track-writes";
import { roleWords, type WordTrack } from "insync/line-track";
import { type GestureCommit, type GestureContext, type SyncGesture, commitGesture } from "insync/sync-commit-gesture";
import type { WordTiming } from "insync/word-timing";
import type { BoundaryEdge } from "insync/word-boundary";
import { bgWordRetimeEdit } from "insync/timing-bg-word-ops";
import type { RetimeChange } from "insync/timing-word-ops";
import { wordRetimeEdit } from "insync/timing-main-word-ops";

// -- Types --------------------------------------------------------------------

interface SyncWordTarget {
  lineId: string;
  track: WordTrack;
  wordIndex: number;
}

// -- Helpers ------------------------------------------------------------------

function lineOf(lines: readonly LyricLine[], lineId: string): LyricLine | undefined {
  return lines.find((line) => line.id === lineId);
}

// -- Commands -----------------------------------------------------------------

// One gesture is one step; `report` gets the plan so the view moves its cursor without planning again.
function syncGesture(
  gesture: SyncGesture,
  ctx: Omit<GestureContext, "groups" | "splitChar">,
  report: (commit: GestureCommit | null) => void,
): LyricCommand {
  return lineEditCommand(
    { command: "sync gesture", args: [gesture, ctx.cursor.lineIndex, ctx.cursor.wordIndex] },
    (root, command) => {
      const commit = commitGesture(root.lines, gesture, { ...ctx, groups: root.groups, splitChar: command.splitChar });
      report(commit);
      return commit?.lineUpdates ?? [];
    },
  );
}

function resetSync(): LyricCommand {
  return lineEditCommand({ command: "reset sync", args: [] }, (root) =>
    root.lines.map((line) => ({ id: line.id, updates: { tracks: withoutLineTiming(line).tracks } })),
  );
}

function retimeSyncWord(
  target: SyncWordTarget,
  edge: BoundaryEdge,
  change: RetimeChange,
  duration: number,
): LyricCommand {
  const { lineId, track, wordIndex } = target;
  return lineEditCommand({ command: "retime sync word", args: [lineId, track, wordIndex, edge] }, (root, ctx) => {
    const line = lineOf(root.lines, lineId);
    if (!line) return refused({ reason: "line-gone", lineId });
    const range = timeRangeResolver(root.lines, root.groups, duration)(line);
    const retime = track === "word" ? wordRetimeEdit : bgWordRetimeEdit;
    const update = retime({ line, wordIdx: wordIndex, edge, change, range, splitChar: ctx.splitChar });
    return update ? [update] : [];
  });
}

function shiftSyncLine(lineId: string, change: RetimeChange, duration: number): LyricCommand {
  return lineEditCommand({ command: "shift sync line", args: [lineId] }, (root) => {
    const line = lineOf(root.lines, lineId);
    if (!line) return refused({ reason: "line-gone", lineId });
    const bounds = effectiveBounds(line);
    if (!bounds) return [];
    const delta = "by" in change ? change.by : change.to - bounds.begin;
    const range = timeRangeResolver(root.lines, root.groups, duration)(line);
    return [{ id: line.id, updates: shiftLineTiming(line, delta, range) }];
  });
}

function splitSyncWord(
  lineId: string,
  wordIndex: number,
  newWords: WordTiming[],
  pieces?: PositionalPieces,
): LyricCommand {
  return lineEditCommand({ command: "split sync word", args: [lineId, wordIndex, newWords.length] }, (root, ctx) => {
    const line = lineOf(root.lines, lineId);
    if (!line) return refused({ reason: "line-gone", lineId });
    if (!roleWords(line, "main")) return [];
    const split = splitWordsKeepingTransliteration(line, "word", wordIndex, newWords, ctx.splitChar, pieces);
    if (!split) return [];
    return [
      { id: line.id, updates: { tracks: withRoleWords(line, "main", split.words).tracks, languages: split.languages } },
    ];
  });
}

// -- Exports ------------------------------------------------------------------

export { resetSync, retimeSyncWord, shiftSyncLine, splitSyncWord, syncGesture };
