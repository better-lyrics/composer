import { withFlatLines } from "@/domain/group/flatten";
import { type BodyItem, type Instance, instanceSlots, type LyricDoc, type TemplateLine } from "@/domain/group/model";
import { readInstance } from "@/domain/group/read-instance";
import { toTemplateLine } from "@/domain/group/template-line";
import { instanceBounds } from "@/domain/instance/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import { isLineFullyTimed, isSyncableLine } from "@/domain/line/sync-progress";

// -- Types --------------------------------------------------------------------

// One instance's lines as they sit in the song: consecutive, in slot order.
interface InstanceRun {
  groupId: string;
  idx: number;
  lines: LyricLine[];
}

interface GroupRead {
  template: readonly TemplateLine[];
  instances: Instance[];
}

// -- Runs ---------------------------------------------------------------------

function slotOf(line: LyricLine): number | undefined {
  return line.groupId !== undefined && line.instanceIdx !== undefined ? line.templateLineIdx : undefined;
}

// A group line out of slot order or apart from the rest of its instance stays a line of its own in the body.
function bodyRuns(lines: readonly LyricLine[]): (LyricLine | InstanceRun)[] {
  const items: (LyricLine | InstanceRun)[] = [];
  const seen = new Set<string>();
  let open: InstanceRun | null = null;
  for (const line of lines) {
    const slot = slotOf(line);
    if (slot === undefined || line.groupId === undefined || line.instanceIdx === undefined) {
      items.push(line);
      open = null;
      continue;
    }
    const lastSlot = open?.lines.at(-1)?.templateLineIdx ?? -1;
    if (open && open.groupId === line.groupId && open.idx === line.instanceIdx && slot > lastSlot) {
      open.lines.push(line);
      continue;
    }
    const key = `${line.groupId}\u0000${line.instanceIdx}`;
    if (seen.has(key)) {
      items.push(line);
      open = null;
      continue;
    }
    seen.add(key);
    open = { groupId: line.groupId, idx: line.instanceIdx, lines: [line] };
    items.push(open);
  }
  return items;
}

function isRun(item: LyricLine | InstanceRun): item is InstanceRun {
  return "lines" in item && "idx" in item;
}

// -- Templates ----------------------------------------------------------------

const attachedLines = (run: InstanceRun) => run.lines.filter((line) => !line.detached);

function isFullyTimed(run: InstanceRun): boolean {
  const syncable = attachedLines(run).filter(isSyncableLine);
  return syncable.length > 0 && syncable.every(isLineFullyTimed);
}

// The instance the template is read from: the first fully timed one, preferring word timing so none is dropped.
function templateRun(runs: readonly InstanceRun[], preferredIdx?: number): InstanceRun {
  const preferred = runs.find((run) => run.idx === preferredIdx);
  if (preferred) return preferred;
  const fullyTimed = runs.filter(isFullyTimed);
  const wordSynced = fullyTimed.find((run) => attachedLines(run).filter(isSyncableLine).every(isWordSynced));
  return wordSynced ?? fullyTimed[0] ?? runs[0];
}

function templateFromRuns(runs: readonly InstanceRun[], preferredIdx?: number): TemplateLine[] {
  const ordered = [templateRun(runs, preferredIdx), ...runs];
  const bySlot = new Map<number, TemplateLine>();
  for (const run of ordered) {
    const at = instanceBounds(attachedLines(run))?.begin;
    for (const line of attachedLines(run)) {
      const slot = line.templateLineIdx ?? 0;
      if (!bySlot.has(slot)) bySlot.set(slot, toTemplateLine(line, slot, at));
    }
  }
  return [...bySlot.values()].toSorted((a, b) => a.slot - b.slot);
}

// -- Groups -------------------------------------------------------------------

// What a doc already knows about a group: its template, the instance a copy came from, and each instance's anchor.
interface GroupHint {
  template?: readonly TemplateLine[];
  preferredIdx?: number;
  anchors?: ReadonlyMap<number, number>;
}

function readRuns(runs: readonly InstanceRun[], template: readonly TemplateLine[], hint: GroupHint): Instance[] {
  return runs.map((run) => readInstance(run.groupId, run.idx, run.lines, template, hint.anchors?.get(run.idx)));
}

// A template is read again from the group's lines when an attached slot follows it in no instance, or it holds a slot
// no instance follows.
function isStale(template: readonly TemplateLine[], instances: readonly Instance[]): boolean {
  const followed = new Set<number>();
  const attached = new Set<number>();
  for (const instance of instances) {
    for (const slot of instanceSlots(instance)) {
      const replaced = instance.replaced?.[slot];
      if (!replaced) followed.add(slot);
      else if (!replaced.detached) attached.add(slot);
    }
  }
  const unfollowed = (slot: number) => !followed.has(slot);
  return [...attached].some(unfollowed) || template.some((line) => unfollowed(line.slot));
}

function readGroup(runs: readonly InstanceRun[], hint: GroupHint = {}): GroupRead {
  if (hint.template) {
    const instances = readRuns(runs, hint.template, hint);
    if (!isStale(hint.template, instances)) return { template: hint.template, instances };
  }
  const template = templateFromRuns(runs, hint.preferredIdx);
  return { template, instances: readRuns(runs, template, hint) };
}

// -- Functions ----------------------------------------------------------------

function runsByGroup(items: readonly (LyricLine | InstanceRun)[]): Map<string, InstanceRun[]> {
  const byGroup = new Map<string, InstanceRun[]>();
  for (const item of items) {
    if (isRun(item)) byGroup.set(item.groupId, [...(byGroup.get(item.groupId) ?? []), item]);
  }
  return byGroup;
}

// The one reader of flat lines into a doc: loads, imports and lines written without their doc. The doc flattens back
// to exactly these lines.
function docFromFlatLines(lines: LyricLine[], hints: ReadonlyMap<string, GroupHint> = new Map()): LyricDoc {
  const items = bodyRuns(lines);
  const templates: Record<string, readonly TemplateLine[]> = {};
  const instanceByRun = new Map<InstanceRun, Instance>();
  for (const [groupId, runs] of runsByGroup(items)) {
    const read = readGroup(runs, hints.get(groupId));
    templates[groupId] = read.template;
    runs.forEach((run, index) => instanceByRun.set(run, read.instances[index]));
  }
  const body: BodyItem[] = items.flatMap<BodyItem>((item) => (isRun(item) ? (instanceByRun.get(item) ?? []) : [item]));
  return withFlatLines({ body, templates }, lines);
}

// -- Exports ------------------------------------------------------------------

export type { GroupHint };
export { docFromFlatLines, readGroup };
