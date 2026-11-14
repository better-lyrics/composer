import {
  attachedLinesOfInstance,
  firstFullyTimedInstance,
  instanceOffset,
  sharedInstancesInLineOrder,
} from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine, TrackRole } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

interface InstanceDrift {
  compared: number;
  // Shared instances whose timed spans sit more than 1 ms and at most 10 ms off their template plus offset.
  offTemplate: number;
}

// -- Constants ----------------------------------------------------------------

const ROLES: readonly TrackRole[] = ["main", "bg"];

// -- Functions ----------------------------------------------------------------

function lineDriftMs(template: LyricLine, line: LyricLine, offset: number): number {
  let drift = 0;
  for (const role of ROLES) {
    const expected = drawnSyllables(template, role);
    const actual = drawnSyllables(line, role);
    if (expected.length !== actual.length) continue;
    expected.forEach((syllable, index) => {
      const begin = Math.abs(syllable.begin + offset - actual[index].begin);
      const end = Math.abs(syllable.end + offset - actual[index].end);
      drift = Math.max(drift, begin, end);
    });
  }
  return Math.round(drift * 1e6) / 1e3;
}

function instanceDriftMs(lines: readonly LyricLine[], groupId: string, template: number, instance: number) {
  const offset = instanceOffset(lines, groupId, template, instance);
  if (offset === null) return null;
  const templateLines = new Map(
    attachedLinesOfInstance(lines, groupId, template).map((line) => [line.templateLineIdx, line]),
  );
  return attachedLinesOfInstance(lines, groupId, instance).reduce((drift, line) => {
    const templateLine = templateLines.get(line.templateLineIdx);
    return templateLine ? Math.max(drift, lineDriftMs(templateLine, line, offset)) : drift;
  }, 0);
}

// Design open point 2: shared instances within the 10 ms same-timing tolerance but more than 1 ms off.
function sharedInstanceDrift(lines: readonly LyricLine[], groups: readonly LinkGroup[]): InstanceDrift {
  let compared = 0;
  let offTemplate = 0;
  for (const group of groups) {
    if (!group.sharesTiming) continue;
    const order = sharedInstancesInLineOrder(lines, group);
    const template = firstFullyTimedInstance(lines, group.id, order);
    if (template === undefined) continue;
    for (const instance of order) {
      if (instance === template) continue;
      const drift = instanceDriftMs(lines, group.id, template, instance);
      if (drift === null) continue;
      compared++;
      if (drift > 1 && drift <= 10) offTemplate++;
    }
  }
  return { compared, offTemplate };
}

// -- Exports ------------------------------------------------------------------

export type { InstanceDrift };
export { sharedInstanceDrift };
