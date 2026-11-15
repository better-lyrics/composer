import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";
import { timeRangeResolver, wholeSongRange } from "insync/group-shared-timing";
import { mainWordsEdit, manualBackgroundWordEdit } from "insync/line-lane-word-edits";
import { isSpanTimed, mainTrack, trackRole } from "insync/line-track";
import { withMainTrack, withTrackSpan } from "insync/line-track-writes";
import { drawnSyllables } from "insync/line-drawn-track";
import type { LineUpdate, LyricLine } from "insync/line";
import type { SyllableAddress } from "insync/selection-model";
import { partitionNudgeSelections, shiftSelectionsTogether } from "insync/selection-nudge";
import { resolveAddress, resolveAddresses, resolveLineIndex } from "insync/selection-resolve";
import { stretchSelections } from "insync/selection-stretch";
import type { StretchAnchor } from "insync/selection-stretch-targets";
import type { StepKey } from "insync/step-timing-step-write";
import type { BoundaryEdge } from "insync/word-boundary";
import type { WordTiming } from "insync/word-timing";
import { bgWordBoundaryEdit } from "@/utils/timing/bg-word-timing";
import { type StepKeyPlan, planStepKey } from "@/utils/timing/step-key-write";
import { wordBoundaryEdit } from "@/utils/timing/word-timing";
import { applyWordPatch } from "insync/word-patch";

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

// -- Helpers ------------------------------------------------------------------

// Timeline edits read the line the way the Timeline draws it: line-synced lines as one word.
function drawnTarget(
  lines: readonly LyricLine[],
  address: SyllableAddress,
  splitChar: string,
): { line: LyricLine; wordIndex: number } | null {
  const lineIndex = resolveLineIndex(lines, address.lineId);
  if (lineIndex === undefined) return null;
  const line = lines[lineIndex];
  const wordIndex = drawnSyllables(line, trackRole(address.type), splitChar).findIndex(
    (word) => word.id === address.syllableId,
  );
  return wordIndex === -1 ? null : { line, wordIndex };
}

function patchedTrack(
  line: LyricLine,
  patch: WordPatch,
  neighbour: WordPatch | undefined,
  splitChar: string,
): LineUpdate[] {
  const words = drawnSyllables(line, trackRole(patch.address.type), splitChar);
  if (words.length === 0) return [];
  const wordIndex = words.findIndex((word) => word.id === patch.address.syllableId);
  const neighbourIndex = neighbour ? words.findIndex((word) => word.id === neighbour.address.syllableId) : undefined;
  const adjacent =
    neighbour && neighbourIndex !== undefined ? { index: neighbourIndex, updates: neighbour.updates } : undefined;
  const updated = applyWordPatch(words, wordIndex, patch.updates, adjacent);
  if (!updated) return [];
  const updates =
    patch.address.type === "word" ? mainWordsEdit(line, updated) : manualBackgroundWordEdit(line, updated, splitChar);
  return [{ id: line.id, updates }];
}

// -- Commands -----------------------------------------------------------------

// A resize or a drawn edge: one word, and the neighbour whose edge rolls with it.
function retimeWord(patch: WordPatch, neighbour?: WordPatch): LyricCommand {
  const { address } = patch;
  return lineEditCommand(
    { command: "retime word", args: [address.lineId, address.type, address.syllableId] },
    (root, ctx) => {
      const line = root.lines.find((candidate) => candidate.id === address.lineId);
      if (!line) return refused({ reason: "line-gone", lineId: address.lineId });
      const main = mainTrack(line);
      if (address.type === "word" && isSpanTimed(main)) {
        const { begin = main.begin, end = main.end } = patch.updates;
        return [{ id: line.id, updates: { tracks: withMainTrack(line, withTrackSpan(main, begin, end)).tracks } }];
      }
      return patchedTrack(line, patch, neighbour, ctx.splitChar);
    },
  );
}

function setWordBoundary(args: BoundaryArgs): LyricCommand {
  const { address, edge, time, duration } = args;
  return lineEditCommand(
    { command: "set word boundary", args: [address.lineId, address.type, address.syllableId, edge, time] },
    (root, ctx) => {
      const target = drawnTarget(root.lines, address, ctx.splitChar);
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
        splitChar: ctx.splitChar,
      });
      return edit ? [edit] : [];
    },
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
    (root, ctx) => {
      const partitioned = partitionNudgeSelections(
        root.lines,
        resolveAddresses(root.lines, addresses, ctx.splitChar),
        ctx.splitChar,
      );
      const rangeOf = timeRangeResolver(root.lines, root.groups, duration);
      const result = shiftSelectionsTogether(root.lines, partitioned, delta, rangeOf, ctx.splitChar);
      const { appliedDelta } = result;
      const wholeSong = () => wholeSongRange(duration);
      const sharedCopyLimited =
        Math.abs(appliedDelta) < Math.abs(delta) &&
        Math.abs(shiftSelectionsTogether(root.lines, partitioned, delta, wholeSong, ctx.splitChar).appliedDelta) >
          Math.abs(appliedDelta);
      report?.({ appliedDelta, moved: result.updates.length > 0, sharedCopyLimited });
      return result.updates;
    },
  );
}

function stretchSelection(args: StretchArgs): LyricCommand {
  const { addresses, factor, anchor } = args;
  return lineEditCommand(
    { command: "stretch", args: [factor, anchor, ...addresses.map((address) => address.syllableId)] },
    (root, ctx) => {
      const options = {
        rangeOf: timeRangeResolver(root.lines, root.groups, args.duration),
        minWordDuration: args.minWordDuration,
        anchor,
      };
      return stretchSelections(
        root.lines,
        resolveAddresses(root.lines, addresses, ctx.splitChar),
        factor,
        options,
        ctx.splitChar,
      ).updates;
    },
  );
}

// `report` receives the committed plan (null when the key changes nothing), so the caller never plans a second time.
function pressStepKey(args: StepKeyArgs, report?: (plan: StepKeyPlan | null) => void): LyricCommand {
  const { cursor, startNext, key } = args;
  return lineEditCommand(
    { command: "step key", args: [key, cursor.lineId, cursor.type, cursor.syllableId, args.time] },
    (root, ctx) => {
      const { lines } = root;
      const resolvedCursor = resolveAddress(lines, cursor, ctx.splitChar);
      if (!resolvedCursor) return refused({ reason: "word-gone", address: cursor });
      const plan = planStepKey({
        lines,
        groups: root.groups,
        cursor: resolvedCursor,
        startNext: startNext && resolveAddress(lines, startNext, ctx.splitChar),
        key,
        time: args.time,
        minDuration: args.minDuration,
        rangeOf: timeRangeResolver(root.lines, root.groups, args.duration),
        splitChar: ctx.splitChar,
      });
      report?.(plan);
      if (!plan) return [];
      return plan.kind === "refused" ? refused({ reason: "step", refusal: plan.refusal }) : plan.updates;
    },
  );
}

// -- Exports ------------------------------------------------------------------

export type { NudgeReport };
export { nudgeSelection, pressStepKey, retimeWord, setWordBoundary, stretchSelection };
