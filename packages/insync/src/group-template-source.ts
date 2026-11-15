import {
  firstFullyTimedInstance,
  instanceOffset,
  sharedInstancesInLineOrder,
  sharesTiming,
} from "./group-shared-timing";
import type { LinkGroup } from "./group";
import { isLinked } from "./instance-predicates";
import type { LyricLine } from "./line";

// -- Types --------------------------------------------------------------------

// A line that gives one slot to a template, and how far it moves to sit in the picked instance's time.
interface SlotSource {
  line: LyricLine;
  slot: number;
  shift: number;
}

// -- Functions ----------------------------------------------------------------

function templateSourceInstance(
  lines: readonly LyricLine[],
  group: LinkGroup | undefined,
  fallback: number,
  splitChar: string,
): number {
  if (!group?.sharesTiming) return fallback;
  const shared = sharedInstancesInLineOrder(lines, group);
  return firstFullyTimedInstance(lines, group.id, shared, splitChar) ?? shared[0] ?? fallback;
}

function pickedTemplateSource(
  lines: readonly LyricLine[],
  group: LinkGroup | undefined,
  picked: number,
  splitChar: string,
): number {
  if (!group?.sharesTiming || sharesTiming(group, picked)) return picked;
  return templateSourceInstance(lines, group, picked, splitChar);
}

function attachedSlotsByInstance(lines: readonly LyricLine[], groupId: string): Map<number, Map<number, LyricLine>> {
  const byInstance = new Map<number, Map<number, LyricLine>>();
  for (const line of lines) {
    if (!isLinked(line) || line.groupId !== groupId || line.detached || line.templateLineIdx === undefined) continue;
    const slots = byInstance.get(line.instanceIdx) ?? new Map<number, LyricLine>();
    if (!slots.has(line.templateLineIdx)) slots.set(line.templateLineIdx, line);
    byInstance.set(line.instanceIdx, slots);
  }
  return byInstance;
}

// Every slot of the group from the picked instance's attached lines. A slot it lost (detached or missing) comes from
// an instance holding every slot, else from any instance holding that one, moved into the picked instance's time.
function templateSlotSources(lines: readonly LyricLine[], groupId: string, picked: number): SlotSource[] {
  const byInstance = attachedSlotsByInstance(lines, groupId);
  const slots = [...new Set([...byInstance.values()].flatMap((held) => [...held.keys()]))].toSorted((a, b) => a - b);
  const instances = [...byInstance.keys()].toSorted((a, b) => a - b);
  const isIntact = (idx: number) => byInstance.get(idx)?.size === slots.length;
  const donors = [...instances.filter(isIntact), ...instances.filter((idx) => !isIntact(idx))];
  return slots.flatMap((slot) => {
    const own = byInstance.get(picked)?.get(slot);
    if (own) return [{ line: own, slot, shift: 0 }];
    const donor = donors.find((idx) => byInstance.get(idx)?.has(slot));
    const line = donor === undefined ? undefined : byInstance.get(donor)?.get(slot);
    if (donor === undefined || !line) return [];
    return [{ line, slot, shift: instanceOffset(lines, groupId, donor, picked) ?? 0 }];
  });
}

// -- Exports ------------------------------------------------------------------

export { pickedTemplateSource, templateSlotSources, templateSourceInstance };
