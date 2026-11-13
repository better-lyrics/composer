import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { PositionalPieces } from "@/domain/language/pieces";
import { splitWordsKeepingTransliteration } from "@/domain/language/reconcile-syllable-split";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { shiftLineTiming } from "@/domain/line/shift";
import type { WordTrack } from "@/domain/line/tracks";
import { type GestureCommit, type GestureContext, type SyncGesture, commitGesture } from "@/domain/sync/commit-gesture";
import { spacedText } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import type { BoundaryEdge } from "@/domain/word/boundary";
import { bgWordRetimeEdit } from "@/utils/timing/bg-word-timing";
import type { RetimeChange } from "@/utils/timing/word-timing-ops";
import { wordRetimeEdit } from "@/utils/timing/word-timing";

// -- Types --------------------------------------------------------------------

interface SyncWordTarget {
  lineId: string;
  track: WordTrack;
  wordIndex: number;
}

// -- Constants ----------------------------------------------------------------

// Timing-only writes never derive text: during a forward pass the words are a prefix of the text.
const TIMING_ONLY = { derivesText: false, propagateToSiblings: false } as const;

// -- Helpers ------------------------------------------------------------------

function lineOf(lines: readonly LyricLine[], lineId: string): LyricLine | undefined {
  return lines.find((line) => line.id === lineId);
}

// -- Commands -----------------------------------------------------------------

// One gesture is one step; `report` gets the plan so the view moves its cursor without planning again.
function syncGesture(
  gesture: SyncGesture,
  ctx: Omit<GestureContext, "groups">,
  report: (commit: GestureCommit | null) => void,
): LyricCommand {
  return lineEditCommand(
    { command: "sync gesture", args: [gesture, ctx.cursor.lineIndex, ctx.cursor.wordIndex] },
    (root) => {
      const commit = commitGesture(root.lines, gesture, { ...ctx, groups: root.groups });
      report(commit);
      return commit?.lineUpdates ?? [];
    },
    TIMING_ONLY,
  );
}

function resetSync(): LyricCommand {
  return lineEditCommand(
    { command: "reset sync", args: [] },
    (root) =>
      root.lines.map((line) => ({
        id: line.id,
        updates: { words: undefined, begin: undefined, end: undefined, backgroundWords: undefined },
      })),
    { propagateToSiblings: false },
  );
}

function retimeSyncWord(
  target: SyncWordTarget,
  edge: BoundaryEdge,
  change: RetimeChange,
  duration: number,
): LyricCommand {
  const { lineId, track, wordIndex } = target;
  return lineEditCommand(
    { command: "retime sync word", args: [lineId, track, wordIndex, edge] },
    (root) => {
      const line = lineOf(root.lines, lineId);
      if (!line) return refused({ reason: "line-gone", lineId });
      const range = timeRangeResolver(root.lines, root.groups, duration)(line);
      const retime = track === "word" ? wordRetimeEdit : bgWordRetimeEdit;
      const update = retime({ line, wordIdx: wordIndex, edge, change, range });
      return update ? [update] : [];
    },
    TIMING_ONLY,
  );
}

function shiftSyncLine(lineId: string, change: RetimeChange, duration: number): LyricCommand {
  return lineEditCommand(
    { command: "shift sync line", args: [lineId] },
    (root) => {
      const line = lineOf(root.lines, lineId);
      if (!line) return refused({ reason: "line-gone", lineId });
      const bounds = effectiveBounds(line);
      if (!bounds) return [];
      const delta = "by" in change ? change.by : change.to - bounds.begin;
      const range = timeRangeResolver(root.lines, root.groups, duration)(line);
      return [{ id: line.id, updates: shiftLineTiming(line, delta, range) }];
    },
    TIMING_ONLY,
  );
}

function splitSyncWord(
  lineId: string,
  wordIndex: number,
  newWords: WordTiming[],
  pieces?: PositionalPieces,
): LyricCommand {
  return lineEditCommand({ command: "split sync word", args: [lineId, wordIndex, newWords.length] }, (root) => {
    const line = lineOf(root.lines, lineId);
    if (!line) return refused({ reason: "line-gone", lineId });
    if (!line.words) return [];
    const split = splitWordsKeepingTransliteration(line, "word", wordIndex, newWords, pieces);
    if (!split) return [];
    return [
      {
        id: line.id,
        updates: {
          words: split.words,
          text: spacedText(split.words).trimEnd(),
          languages: split.languages,
        },
      },
    ];
  });
}

// -- Exports ------------------------------------------------------------------

export { resetSync, retimeSyncWord, shiftSyncLine, splitSyncWord, syncGesture };
