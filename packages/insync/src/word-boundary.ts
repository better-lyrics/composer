import { type TimeRange, UNBOUNDED_TIME_RANGE } from "./group-shared-timing";
import type { SyllablePosition } from "./word-syllable-groups";
import type { WordTiming } from "./word-timing";

// -- Types --------------------------------------------------------------------

type BoundaryEdge = "begin" | "end";

interface BoundaryClampInput {
  words: readonly WordTiming[];
  wordIndex: number;
  edge: BoundaryEdge;
  time: number;
  minDuration: number;
  rollNeighbour: boolean;
  range?: TimeRange;
}

interface RollDecisionInput {
  words: readonly WordTiming[];
  wordIndex: number;
  edge: BoundaryEdge;
  rollingEdit: boolean;
  syllablesFollowRolling: boolean;
  syllablePositions: readonly SyllablePosition[];
  altHeld?: boolean;
}

// -- Predicates ---------------------------------------------------------------

// Overlaps count as flush, preserving the drag path's original `prev.end < word.begin` test.
function isBoundaryFlush(words: readonly WordTiming[], wordIndex: number, edge: BoundaryEdge): boolean {
  const word = words[wordIndex];
  if (!word) return false;
  if (edge === "begin") {
    const prev = words[wordIndex - 1];
    return prev !== undefined && prev.end >= word.begin;
  }
  const next = words[wordIndex + 1];
  return next !== undefined && next.begin <= word.end;
}

function isInsideSyllableGroup(position: SyllablePosition | undefined, edge: BoundaryEdge): boolean {
  if (edge === "end") return position === "first" || position === "middle";
  return position === "middle" || position === "last";
}

// -- Roll decision ------------------------------------------------------------

// Syllables of one word carry their neighbour without Rolling unless opted out; separate words need it.
// `altHeld` is the drag-only inversion: keyboard paths omit it and take the default.
function shouldRollNeighbour({
  words,
  wordIndex,
  edge,
  rollingEdit,
  syllablesFollowRolling,
  syllablePositions,
  altHeld = false,
}: RollDecisionInput): boolean {
  const neighbour = edge === "begin" ? words[wordIndex - 1] : words[wordIndex + 1];
  // Nothing to roll at the array ends, so Alt has nothing to invert into either.
  if (!words[wordIndex] || !neighbour) return false;

  const syllablesRollOnTheirOwn = !syllablesFollowRolling && isInsideSyllableGroup(syllablePositions[wordIndex], edge);
  const rollsByDefault = (rollingEdit || syllablesRollOnTheirOwn) && isBoundaryFlush(words, wordIndex, edge);
  return altHeld ? !rollsByDefault : rollsByDefault;
}

// -- Clamp --------------------------------------------------------------------

// A pair spanning under twice minDuration cannot satisfy both floors, so the hard
// ceiling gives up the minimum rather than letting either word invert.
function clampBoundaryTime({
  words,
  wordIndex,
  edge,
  time,
  minDuration,
  rollNeighbour,
  range = UNBOUNDED_TIME_RANGE,
}: BoundaryClampInput): number {
  const word = words[wordIndex];
  if (!word) return time;

  if (edge === "begin") {
    const prev = words[wordIndex - 1];
    const floor = rollNeighbour && prev ? prev.begin + minDuration : (prev?.end ?? range.min);
    return Math.min(word.end, Math.max(floor, Math.min(word.end - minDuration, time)));
  }

  const next = words[wordIndex + 1];
  const neighbourCeiling = rollNeighbour && next ? next.end : (next?.begin ?? Number.POSITIVE_INFINITY);
  const hardCeiling = Math.max(word.begin, Math.min(neighbourCeiling, range.max));
  const ceiling = rollNeighbour && next ? next.end - minDuration : hardCeiling;
  return Math.min(hardCeiling, Math.max(word.begin + minDuration, Math.min(ceiling, time)));
}

// A roll moves the edge both words share; at or past either word's far edge one of them is left no length.
function rollKeepsBothWords(
  words: readonly WordTiming[],
  wordIndex: number,
  edge: BoundaryEdge,
  time: number,
): boolean {
  const word = words[wordIndex];
  if (edge === "begin") {
    const prev = words[wordIndex - 1];
    return !prev || (time > prev.begin && time < word.end);
  }
  const next = words[wordIndex + 1];
  return !next || (time < next.end && time > word.begin);
}

// Where a boundary edit lands, or null when its roll would leave either word no length. Drag and command share it.
function boundaryTarget(input: BoundaryClampInput): number | null {
  const clamped = clampBoundaryTime(input);
  const { words, wordIndex, edge, rollNeighbour } = input;
  return rollNeighbour && !rollKeepsBothWords(words, wordIndex, edge, clamped) ? null : clamped;
}

// An end set exactly where the word starts has nothing to end; writing it would only squeeze the word to the minimum.
function endsAtOwnStart(word: WordTiming, edge: BoundaryEdge, time: number): boolean {
  return edge === "end" && time === word.begin;
}

// -- Exports ------------------------------------------------------------------

export { boundaryTarget, clampBoundaryTime, endsAtOwnStart, isBoundaryFlush, shouldRollNeighbour };
export type { BoundaryEdge };
