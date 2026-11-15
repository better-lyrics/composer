import { drawnSyllables } from "./line-drawn-track";
import { mainTrack, roleWords } from "./line-track";
import { withSharing } from "./group-own-timing";
import { sameTime } from "./group-same-timing";
import { type SharingOutcome, realignSharedInstances } from "./group-shared-placement";
import {
  attachedLinesOfInstance,
  firstFullyTimedInstance,
  instanceOffset,
  instanceStart,
  instancesInLineOrder,
} from "./group-shared-timing";
import type { LinkGroup } from "./group";
import type { LyricLine } from "./line";
import type { WordTiming } from "./word-timing";

// -- Types --------------------------------------------------------------------

interface InitialGroupSharing extends SharingOutcome {
  group: LinkGroup;
  lines: LyricLine[];
}

// -- Comparison ---------------------------------------------------------------

function sameWords(a: readonly WordTiming[] | undefined, b: readonly WordTiming[] | undefined, offset: number) {
  if (!a || !b) return a === b;
  return (
    a.length === b.length &&
    a.every((word, i) => sameTime(word.begin, b[i].begin, offset) && sameTime(word.end, b[i].end, offset))
  );
}

function sameRelativeTiming(
  lines: readonly LyricLine[],
  groupId: string,
  source: number,
  other: number,
  splitChar: string,
): boolean {
  const offset = instanceOffset(lines, groupId, source, other);
  if (offset === null) return false;
  const sourceByTemplateLine = new Map(
    attachedLinesOfInstance(lines, groupId, source).map((line) => [line.templateLineIdx, line]),
  );
  return attachedLinesOfInstance(lines, groupId, other).every((line) => {
    const match = sourceByTemplateLine.get(line.templateLineIdx);
    if (!match) return true;
    return (
      sameTime(mainTrack(match).begin, mainTrack(line).begin, offset) &&
      sameTime(mainTrack(match).end, mainTrack(line).end, offset) &&
      sameWords(roleWords(match, "main"), roleWords(line, "main"), offset) &&
      sameWords(drawnSyllables(match, "bg", splitChar), drawnSyllables(line, "bg", splitChar), offset)
    );
  });
}

// -- Sharing ------------------------------------------------------------------

function instancesWithDifferentTiming(lines: readonly LyricLine[], groupId: string, splitChar: string): number[] {
  const order = instancesInLineOrder(lines, groupId);
  const timed = order.filter((instanceIdx) => instanceStart(lines, groupId, instanceIdx) !== null);
  const source = firstFullyTimedInstance(lines, groupId, timed, splitChar) ?? timed[0];
  if (source === undefined) return [];
  return order.filter(
    (instanceIdx) =>
      instanceIdx !== source &&
      instanceStart(lines, groupId, instanceIdx) !== null &&
      !sameRelativeTiming(lines, groupId, source, instanceIdx, splitChar),
  );
}

function initialGroupSharing(
  lines: LyricLine[],
  group: LinkGroup,
  settingOn: boolean,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): InitialGroupSharing {
  if (!settingOn) return { group, lines, keptOwnTiming: [], replaced: [] };
  const shared = withSharing(group, { sharesTiming: true });
  const differing = instancesWithDifferentTiming(lines, group.id, splitChar);
  const realigned = realignSharedInstances(lines, [shared], group.id, differing, splitChar, songEnd);
  const ownTimingInstances = realigned.keptOwnTiming.map((kept) => kept.instanceIdx);
  return {
    ...realigned,
    group: ownTimingInstances.length ? withSharing(group, { sharesTiming: true, ownTimingInstances }) : shared,
  };
}

// -- Exports ------------------------------------------------------------------

export { initialGroupSharing };
