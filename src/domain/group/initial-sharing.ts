import { withSharing } from "@/domain/group/own-timing";
import { sameTime } from "@/domain/group/same-timing";
import { type SharingOutcome, realignSharedInstances } from "@/domain/group/shared-placement";
import {
  attachedLinesOfInstance,
  firstFullyTimedInstance,
  instanceOffset,
  instanceStart,
  instancesInLineOrder,
} from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

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

function instancesWithDifferentTiming(lines: readonly LyricLine[], groupId: string): number[] {
  const order = instancesInLineOrder(lines, groupId);
  const timed = order.filter((instanceIdx) => instanceStart(lines, groupId, instanceIdx) !== null);
  const source = firstFullyTimedInstance(lines, groupId, timed) ?? timed[0];
  if (source === undefined) return [];
  return order.filter(
    (instanceIdx) =>
      instanceIdx !== source &&
      instanceStart(lines, groupId, instanceIdx) !== null &&
      !sameRelativeTiming(lines, groupId, source, instanceIdx),
  );
}

function initialGroupSharing(
  lines: LyricLine[],
  group: LinkGroup,
  settingOn: boolean,
  songEnd = Number.POSITIVE_INFINITY,
): InitialGroupSharing {
  if (!settingOn) return { group, lines, keptOwnTiming: [], replaced: [] };
  const shared = withSharing(group, { sharesTiming: true });
  const differing = instancesWithDifferentTiming(lines, group.id);
  const realigned = realignSharedInstances(lines, [shared], group.id, differing, songEnd);
  const ownTimingInstances = realigned.keptOwnTiming.map((kept) => kept.instanceIdx);
  return {
    ...realigned,
    group: ownTimingInstances.length ? withSharing(group, { sharesTiming: true, ownTimingInstances }) : shared,
  };
}

// -- Exports ------------------------------------------------------------------

export { initialGroupSharing };
