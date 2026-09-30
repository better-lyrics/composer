import {
  attachedLinesOfInstance,
  instanceOffset,
  instanceStart,
  isInstanceFullyTimed,
} from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type InitialSharing = Pick<LinkGroup, "sharesTiming" | "ownTimingInstances">;

// -- Constants ----------------------------------------------------------------

const SAME_TIMING_TOLERANCE_SECONDS = 0.01;

// -- Comparison ---------------------------------------------------------------

function sameTime(a: number | undefined, b: number | undefined, offset: number): boolean {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a + offset - b) <= SAME_TIMING_TOLERANCE_SECONDS;
}

function sameWords(a: readonly WordTiming[] | undefined, b: readonly WordTiming[] | undefined, offset: number) {
  if (!a || !b) return a === b;
  return (
    a.length === b.length &&
    a.every((word, i) => sameTime(word.begin, b[i].begin, offset) && sameTime(word.end, b[i].end, offset))
  );
}

function sameRelativeTiming(lines: readonly LyricLine[], groupId: string, source: number, other: number): boolean {
  const offset = instanceOffset(lines, groupId, source, other);
  if (offset === null) return false;
  const sourceByTemplateLine = new Map(
    attachedLinesOfInstance(lines, groupId, source).map((line) => [line.templateLineIdx, line]),
  );
  return attachedLinesOfInstance(lines, groupId, other).every((line) => {
    const match = sourceByTemplateLine.get(line.templateLineIdx);
    if (!match) return true;
    return (
      sameTime(match.begin, line.begin, offset) &&
      sameTime(match.end, line.end, offset) &&
      sameWords(match.words, line.words, offset) &&
      sameWords(match.backgroundWords, line.backgroundWords, offset)
    );
  });
}

// -- Sharing ------------------------------------------------------------------

function instancesInLineOrder(lines: readonly LyricLine[], groupId: string): number[] {
  const order = new Set<number>();
  for (const line of lines) {
    if (line.groupId !== groupId || line.detached || line.instanceIdx === undefined) continue;
    order.add(line.instanceIdx);
  }
  return [...order];
}

function initialSharing(lines: readonly LyricLine[], groupId: string, settingOn: boolean): InitialSharing {
  if (!settingOn) return {};
  const order = instancesInLineOrder(lines, groupId);
  const timed = order.filter((instanceIdx) => instanceStart(lines, groupId, instanceIdx) !== null);
  const source = timed.find((instanceIdx) => isInstanceFullyTimed(lines, groupId, instanceIdx)) ?? timed[0];
  if (source === undefined) return { sharesTiming: true };
  const ownTimingInstances = order.filter(
    (instanceIdx) =>
      instanceIdx !== source &&
      instanceStart(lines, groupId, instanceIdx) !== null &&
      !sameRelativeTiming(lines, groupId, source, instanceIdx),
  );
  return ownTimingInstances.length ? { sharesTiming: true, ownTimingInstances } : { sharesTiming: true };
}

// -- Exports ------------------------------------------------------------------

export { initialSharing, instancesInLineOrder };
export type { InitialSharing };
