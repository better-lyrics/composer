import { withFlatLines } from "insync/group-flatten";
import {
  type BodyItem,
  type Instance,
  type InstanceSpan,
  instanceSlots,
  type LyricDoc,
  type TemplateLine,
} from "insync/group";
import { readInstance } from "insync/group-read-instance";
import { toTemplateLine } from "insync/group-template-line";
import { instanceBounds } from "insync/instance-bounds";
import { instanceKey } from "insync/instance-key";
import type { LyricLine } from "insync/line";
import { isWordSynced } from "insync/line-predicates";
import { isLineFullyTimed, isSyncableLine } from "@/domain/line/sync-progress";

// -- Types --------------------------------------------------------------------

// One instance's lines, wherever they sit, in song order.
interface InstanceRun {
  groupId: string;
  idx: number;
  lines: LyricLine[];
}

interface GroupRead {
  template: readonly TemplateLine[];
  instances: Instance[];
}

type OpenSpan = InstanceSpan & { slots: number[] };

interface BodyRead {
  body: BodyItem[];
  runsByGroup: Map<string, InstanceRun[]>;
}

// -- Body ---------------------------------------------------------------------

// An instance is its group and index wherever its lines sit; the body keeps their order as spans. A line repeating a
// slot its instance already has stays a line of its own.
function readBody(lines: readonly LyricLine[]): BodyRead {
  const body: BodyItem[] = [];
  const runsByGroup = new Map<string, InstanceRun[]>();
  const runs = new Map<string, InstanceRun>();
  const takenSlots = new Set<string>();
  let open: OpenSpan | null = null;
  for (const line of lines) {
    const { groupId, instanceIdx, templateLineIdx: slot } = line;
    if (groupId === undefined || instanceIdx === undefined || slot === undefined) {
      body.push(line);
      open = null;
      continue;
    }
    const key = instanceKey(groupId, instanceIdx);
    const slotKey = `${key}\u0000${slot}`;
    if (takenSlots.has(slotKey)) {
      body.push(line);
      open = null;
      continue;
    }
    takenSlots.add(slotKey);
    let run = runs.get(key);
    if (!run) {
      run = { groupId, idx: instanceIdx, lines: [] };
      runs.set(key, run);
      const groupRuns = runsByGroup.get(groupId);
      if (groupRuns) groupRuns.push(run);
      else runsByGroup.set(groupId, [run]);
    }
    run.lines.push(line);
    if (open && open.key === key) {
      open.slots.push(slot);
      continue;
    }
    const span: OpenSpan = { kind: "instance", key, slots: [slot] };
    body.push(span);
    open = span;
  }
  return { body, runsByGroup };
}

// -- Templates ----------------------------------------------------------------

const attachedLines = (run: InstanceRun) => run.lines.filter((line) => !line.detached);

function isFullyTimed(run: InstanceRun, splitChar: string): boolean {
  const syncable = attachedLines(run).filter((value) => isSyncableLine(value, splitChar));
  return syncable.length > 0 && syncable.every((value) => isLineFullyTimed(value, splitChar));
}

// The instance the template is read from: the first fully timed one, preferring word timing so none is dropped.
function templateRun(runs: readonly InstanceRun[], splitChar: string, preferredIdx?: number): InstanceRun {
  const preferred = runs.find((run) => run.idx === preferredIdx);
  if (preferred) return preferred;
  const fullyTimed = runs.filter((value) => isFullyTimed(value, splitChar));
  const wordSynced = fullyTimed.find((run) =>
    attachedLines(run)
      .filter((value) => isSyncableLine(value, splitChar))
      .every(isWordSynced),
  );
  return wordSynced ?? fullyTimed[0] ?? runs[0];
}

function templateFromRuns(runs: readonly InstanceRun[], splitChar: string, preferredIdx?: number): TemplateLine[] {
  const ordered = [templateRun(runs, splitChar, preferredIdx), ...runs];
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

function readGroup(runs: readonly InstanceRun[], splitChar: string, hint: GroupHint = {}): GroupRead {
  if (hint.template) {
    const instances = readRuns(runs, hint.template, hint);
    if (!isStale(hint.template, instances)) return { template: hint.template, instances };
  }
  const template = templateFromRuns(runs, splitChar, hint.preferredIdx);
  return { template, instances: readRuns(runs, template, hint) };
}

// -- Functions ----------------------------------------------------------------

// Reads the given groups of a body; every other group keeps its instances and template from `previous`.
function docFromBody(
  { body, runsByGroup }: BodyRead,
  lines: LyricLine[],
  reread: (groupId: string) => boolean,
  previous: LyricDoc | null,
  hints: ReadonlyMap<string, GroupHint>,
  splitChar: string,
): LyricDoc {
  const instances: Record<string, Instance> = {};
  const templates: Record<string, readonly TemplateLine[]> = {};
  for (const [groupId, runs] of runsByGroup) {
    const kept = !reread(groupId) && previous ? previous.templates[groupId] : undefined;
    if (kept && previous) {
      templates[groupId] = kept;
      for (const run of runs) {
        const key = instanceKey(groupId, run.idx);
        instances[key] = previous.instances[key];
      }
      continue;
    }
    const read = readGroup(runs, splitChar, hints.get(groupId));
    templates[groupId] = read.template;
    runs.forEach((run, order) => {
      instances[instanceKey(groupId, run.idx)] = read.instances[order];
    });
  }
  return withFlatLines({ body, instances, templates }, lines);
}

// The one reader of flat lines into a doc: loads, imports and lines written without their doc. The doc flattens back
// to these lines, to the millisecond, and is kept with these very lines.
function docFromFlatLines(
  lines: LyricLine[],
  splitChar: string,
  hints: ReadonlyMap<string, GroupHint> = new Map(),
): LyricDoc {
  return docFromBody(readBody(lines), lines, () => true, null, hints, splitChar);
}

// The doc of new lines that keeps the instances and templates of every group whose lines did not change.
function docAfterLines(
  previous: LyricDoc,
  lines: LyricLine[],
  changedGroups: ReadonlySet<string>,
  hints: ReadonlyMap<string, GroupHint>,
  splitChar: string,
): LyricDoc {
  return docFromBody(readBody(lines), lines, (groupId) => changedGroups.has(groupId), previous, hints, splitChar);
}

// -- Exports ------------------------------------------------------------------

export type { GroupHint };
export { docAfterLines, docFromFlatLines };
