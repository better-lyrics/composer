import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";
import { timeRangeResolver, wholeSongRange } from "@/domain/group/shared-timing";
import { mainWordsEdit, manualBackgroundWordEdit } from "@/domain/line/lane-word-edits";
import { isSpanTimed, mainTrack, trackWords } from "@/domain/line/track";
import { withMainTrack, withTrackSpan } from "@/domain/line/track-writes";
import {
  type EffectiveLine,
  effectiveTrackWords,
  getEffectiveLine,
  getEffectiveLines,
} from "@/domain/line/effective-words";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import type { SyllableAddress } from "@/domain/selection/model";
import { partitionNudgeSelections, shiftSelectionsTogether } from "@/domain/selection/nudge";
import { resolveAddress, resolveAddresses, resolveLineIndex } from "@/domain/selection/resolve";
import { stretchSelections } from "@/domain/selection/stretch";
import type { StretchAnchor } from "@/domain/selection/stretch-targets";
import type { StepKey } from "@/domain/step-timing/step-write";
import type { BoundaryEdge } from "@/domain/word/boundary";
import type { WordTiming } from "@/domain/word/timing";
import { bgWordBoundaryEdit } from "@/utils/timing/bg-word-timing";
import { type StepKeyPlan, planStepKey } from "@/utils/timing/step-key-write";
import { wordBoundaryEdit } from "@/utils/timing/word-timing";
import { applyWordPatch } from "@/utils/word-patch";

// -- Types --------------------------------------------------------------------

interface WordPatch {
  address: SyllableAddress;
  updates: Partial<WordTiming>;
}

interface BoundaryArgs {
  address: SyllableAddress;
  edge: BoundaryEdge;
  time: number;
  minDuration: number;
  rolling: boolean;
  syllablesFollowRolling: boolean;
  duration: number;
}

interface StretchArgs {
  addresses: readonly SyllableAddress[];
  factor: number;
  anchor: StretchAnchor;
  minWordDuration: number;
  duration: number;
}

interface NudgeReport {
  appliedDelta: number;
  moved: boolean;
  // The song edge stopped a shared copy before it stopped the selection itself.
  sharedCopyLimited: boolean;
}

interface StepKeyArgs {
  cursor: SyllableAddress;
  startNext: SyllableAddress | null;
  key: StepKey;
  time: number;
  minDuration: number;
  duration: number;
}

// -- Constants ----------------------------------------------------------------

const TIMING_ONLY = { propagateToSiblings: false } as const;
const OWN_LINE_ONLY = { propagateToSiblings: false } as const;

// -- Helpers ------------------------------------------------------------------

// Timeline edits read the line the way the Timeline draws it: line-synced lines as one word.
function effectiveTarget(
  lines: readonly LyricLine[],
  address: SyllableAddress,
): { line: EffectiveLine; wordIndex: number } | null {
  const lineIndex = resolveLineIndex(lines, address.lineId);
  if (lineIndex === undefined) return null;
  const line = getEffectiveLine(lines[lineIndex]);
  const wordIndex = effectiveTrackWords(line, address.type)?.findIndex((word) => word.id === address.syllableId) ?? -1;
  return wordIndex === -1 ? null : { line, wordIndex };
}

function patchedTrack(line: LyricLine, patch: WordPatch, neighbour: WordPatch | undefined): LineUpdate[] {
  const words = trackWords(line, patch.address.type);
  if (!words) return [];
  const wordIndex = words.findIndex((word) => word.id === patch.address.syllableId);
  const neighbourIndex = neighbour ? words.findIndex((word) => word.id === neighbour.address.syllableId) : undefined;
  const adjacent =
    neighbour && neighbourIndex !== undefined ? { index: neighbourIndex, updates: neighbour.updates } : undefined;
  const updated = applyWordPatch(words, wordIndex, patch.updates, adjacent);
  if (!updated) return [];
  const updates =
    patch.address.type === "word" ? mainWordsEdit(line, updated) : manualBackgroundWordEdit(line, updated);
  return [{ id: line.id, updates }];
}

// -- Commands -----------------------------------------------------------------

// A resize or a drawn edge: one word, and the neighbour whose edge rolls with it.
function retimeWord(patch: WordPatch, neighbour?: WordPatch): LyricCommand {
  const { address } = patch;
  return lineEditCommand(
    { command: "retime word", args: [address.lineId, address.type, address.syllableId] },
    (root) => {
      const line = root.lines.find((candidate) => candidate.id === address.lineId);
      if (!line) return refused({ reason: "line-gone", lineId: address.lineId });
      const main = mainTrack(line);
      if (address.type === "word" && isSpanTimed(main)) {
        const { begin = main.begin, end = main.end } = patch.updates;
        return [{ id: line.id, updates: { tracks: withMainTrack(line, withTrackSpan(main, begin, end)).tracks } }];
      }
      return patchedTrack(line, patch, neighbour);
    },
    OWN_LINE_ONLY,
  );
}

function setWordBoundary(args: BoundaryArgs): LyricCommand {
  const { address, edge, time, duration } = args;
  return lineEditCommand(
    { command: "set word boundary", args: [address.lineId, address.type, address.syllableId, edge, time] },
    (root) => {
      const target = effectiveTarget(root.lines, address);
      if (!target) return refused({ reason: "word-gone", address });
      const boundaryEdit = address.type === "word" ? wordBoundaryEdit : bgWordBoundaryEdit;
      const edit = boundaryEdit({
        line: target.line,
        wordIdx: target.wordIndex,
        edge,
        time,
        minDuration: args.minDuration,
        rolling: args.rolling,
        syllablesFollowRolling: args.syllablesFollowRolling,
        range: timeRangeResolver(root.lines, root.groups, duration)(target.line),
      });
      return edit ? [edit] : [];
    },
    TIMING_ONLY,
  );
}

// `report` receives the committed result, so the caller never plans a second time.
function nudgeSelection(
  addresses: readonly SyllableAddress[],
  delta: number,
  duration: number,
  report?: (nudge: NudgeReport) => void,
): LyricCommand {
  return lineEditCommand(
    { command: "nudge", args: [delta, ...addresses.map((address) => address.syllableId)] },
    (root) => {
      const partitioned = partitionNudgeSelections(root.lines, resolveAddresses(root.lines, addresses));
      const rangeOf = timeRangeResolver(root.lines, root.groups, duration);
      const result = shiftSelectionsTogether(root.lines, partitioned, delta, rangeOf);
      const { appliedDelta } = result;
      const wholeSong = () => wholeSongRange(duration);
      const sharedCopyLimited =
        Math.abs(appliedDelta) < Math.abs(delta) &&
        Math.abs(shiftSelectionsTogether(root.lines, partitioned, delta, wholeSong).appliedDelta) >
          Math.abs(appliedDelta);
      report?.({ appliedDelta, moved: result.updates.length > 0, sharedCopyLimited });
      return result.updates;
    },
    OWN_LINE_ONLY,
  );
}

function stretchSelection(args: StretchArgs): LyricCommand {
  const { addresses, factor, anchor } = args;
  return lineEditCommand(
    { command: "stretch", args: [factor, anchor, ...addresses.map((address) => address.syllableId)] },
    (root) => {
      const options = {
        rangeOf: timeRangeResolver(root.lines, root.groups, args.duration),
        minWordDuration: args.minWordDuration,
        anchor,
      };
      return stretchSelections(root.lines, resolveAddresses(root.lines, addresses), factor, options).updates;
    },
    OWN_LINE_ONLY,
  );
}

// `report` receives the committed plan (null when the key changes nothing), so the caller never plans a second time.
function pressStepKey(args: StepKeyArgs, report?: (plan: StepKeyPlan | null) => void): LyricCommand {
  const { cursor, startNext, key } = args;
  return lineEditCommand(
    { command: "step key", args: [key, cursor.lineId, cursor.type, cursor.syllableId, args.time] },
    (root) => {
      const lines = getEffectiveLines(root.lines);
      const resolvedCursor = resolveAddress(lines, cursor);
      if (!resolvedCursor) return refused({ reason: "word-gone", address: cursor });
      const plan = planStepKey({
        lines,
        groups: root.groups,
        cursor: resolvedCursor,
        startNext: startNext && resolveAddress(lines, startNext),
        key,
        time: args.time,
        minDuration: args.minDuration,
        rangeOf: timeRangeResolver(root.lines, root.groups, args.duration),
      });
      report?.(plan);
      if (!plan) return [];
      return plan.kind === "refused" ? refused({ reason: "step", refusal: plan.refusal }) : plan.updates;
    },
    TIMING_ONLY,
  );
}

// -- Exports ------------------------------------------------------------------

export type { NudgeReport };
export { nudgeSelection, pressStepKey, retimeWord, setWordBoundary, stretchSelection };
