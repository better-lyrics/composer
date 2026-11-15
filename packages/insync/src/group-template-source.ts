import {
  firstFullyTimedInstance,
  offsetBetweenInstanceLines,
  sharedInstancesInLineOrder,
  sharesTiming,
} from "./group-shared-timing";
import type { LinkGroup } from "./group";
import { isLinked } from "./instance-predicates";
import type { LyricLine } from "./line";

// -- Types --------------------------------------------------------------------

// A line that gives one slot to a template, and how far it moves to sit in the picked instance's time; null when no
// shared timed slot places it, so the slot goes in untimed.
interface SlotSource {
  line: LyricLine;
  slot: number;
  shift: number | null;
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

interface AttachedInstances {
  linesByInstance: Map<number, LyricLine[]>;
  slotsByInstance: Map<number, Map<number, LyricLine>>;
}

function attachedInstances(lines: readonly LyricLine[], groupId: string): AttachedInstances {
  const linesByInstance = new Map<number, LyricLine[]>();
  const slotsByInstance = new Map<number, Map<number, LyricLine>>();
  for (const line of lines) {
    if (!isLinked(line) || line.groupId !== groupId || line.detached) continue;
    const attached = linesByInstance.get(line.instanceIdx) ?? [];
    attached.push(line);
    linesByInstance.set(line.instanceIdx, attached);
    if (line.templateLineIdx === undefined) continue;
    const slots = slotsByInstance.get(line.instanceIdx) ?? new Map<number, LyricLine>();
    if (!slots.has(line.templateLineIdx)) slots.set(line.templateLineIdx, line);
    slotsByInstance.set(line.instanceIdx, slots);
  }
  return { linesByInstance, slotsByInstance };
}

// Every slot of the group from the picked instance's attached lines. A slot it lost (detached or missing) comes from
// an instance holding every slot, else from any instance holding that one, moved into the picked instance's time; an
// instance that shares a timed slot with the pick comes first, as only it can be moved there.
function templateSlotSources(lines: readonly LyricLine[], groupId: string, picked: number): SlotSource[] {
  const { linesByInstance, slotsByInstance: byInstance } = attachedInstances(lines, groupId);
  const slots = [...new Set([...byInstance.values()].flatMap((held) => [...held.keys()]))].toSorted((a, b) => a - b);
  const instances = [...byInstance.keys()].toSorted((a, b) => a - b);
  const isIntact = (idx: number) => byInstance.get(idx)?.size === slots.length;
  const donors = [...instances.filter(isIntact), ...instances.filter((idx) => !isIntact(idx))];
  const pickedLines = linesByInstance.get(picked) ?? [];
  const offsets = new Map<number, number | null>();
  const offsetFrom = (donor: number) => {
    if (!offsets.has(donor)) {
      offsets.set(donor, offsetBetweenInstanceLines(linesByInstance.get(donor) ?? [], pickedLines));
    }
    return offsets.get(donor) ?? null;
  };
  return slots.flatMap((slot) => {
    const own = byInstance.get(picked)?.get(slot);
    if (own) return [{ line: own, slot, shift: 0 }];
    const holders = donors.flatMap((idx) => {
      const line = byInstance.get(idx)?.get(slot);
      return line ? [{ line, slot, shift: offsetFrom(idx) }] : [];
    });
    const placed = holders.find(({ shift }) => shift !== null);
    return placed ? [placed] : holders.slice(0, 1);
  });
}

// -- Exports ------------------------------------------------------------------

export { pickedTemplateSource, templateSlotSources, templateSourceInstance };
