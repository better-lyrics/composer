import { sameSharedContent } from "@/domain/group/carried-line";
import { clampedToRoom } from "@/domain/group/clamped-edit";
import { instanceSlotLine, templateBySlot } from "@/domain/group/flatten";
import { invertedIds, withLineIds } from "@/domain/group/line-ids";
import { type Instance, instanceSlots, isInstanceSpan, type LyricDoc, type TemplateLine } from "insync/group";
import { offsetTimingFields } from "@/domain/group/offset-timing";
import { sharesTiming, timingChanged } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { fittedAnchor, lineContent, toTemplateLine } from "@/domain/group/template-line";
import { instanceBounds } from "@/domain/instance/bounds";
import { instanceKey } from "insync/instance-key";
import { isLinked, type LinkedLine } from "insync/instance-predicates";
import type { LyricLine } from "insync/line";

// -- Types --------------------------------------------------------------------

// A group's instance anchors by instance index, worked out the first time a fold asks for that group.
type InstanceAnchors = (groupId: string) => ReadonlyMap<number, number>;

interface CopyInput {
  doc: LyricDoc;
  before: readonly LyricLine[];
  after: LyricLine[];
  groups: readonly LinkGroup[];
  touched: readonly string[];
  anchors: InstanceAnchors;
  songEnd: number;
}

interface TemplateCopy {
  lines: LyricLine[];
  copiedGroupIds: string[];
  // Per group: the template the copies came from and the instance that wrote it.
  templates: Map<string, readonly TemplateLine[]>;
  sources: Map<string, number>;
}

type SlotLine = LinkedLine & { templateLineIdx: number };

// -- Anchors ------------------------------------------------------------------

// An instance's anchor is where its template is placed. One on its own timing, or holding its own lines, anchors where
// its first line timed in both meets the template, else at its first time.
function instanceAnchor(doc: LyricDoc, instance: Instance): number | undefined {
  if (instance.at !== undefined) return instance.at;
  const template = templateBySlot(doc.templates[instance.groupId] ?? []);
  const slots = instanceSlots(instance).flatMap((slot) => {
    const content = instanceSlotLine(doc, instance, slot);
    const templateLine = template.get(slot);
    return content && templateLine && !content.detached ? [{ template: templateLine, content }] : [];
  });
  return fittedAnchor(slots) ?? instanceBounds(slots.map(({ content }) => content))?.begin;
}

const instancesByGroup = new WeakMap<LyricDoc, Map<string, Instance[]>>();

function groupInstances(doc: LyricDoc, groupId: string): readonly Instance[] {
  let byGroup = instancesByGroup.get(doc);
  if (!byGroup) {
    byGroup = new Map();
    for (const instance of Object.values(doc.instances)) {
      const instances = byGroup.get(instance.groupId);
      if (instances) instances.push(instance);
      else byGroup.set(instance.groupId, [instance]);
    }
    instancesByGroup.set(doc, byGroup);
  }
  return byGroup.get(groupId) ?? [];
}

function instanceAnchors(doc: LyricDoc): InstanceAnchors {
  const anchors = new Map<string, Map<number, number>>();
  return (groupId) => {
    const known = anchors.get(groupId);
    if (known) return known;
    const byIdx = new Map<number, number>();
    for (const instance of groupInstances(doc, groupId)) {
      const at = instanceAnchor(doc, instance);
      if (at !== undefined) byIdx.set(instance.idx, at);
    }
    anchors.set(groupId, byIdx);
    return byIdx;
  };
}

// -- Helpers ------------------------------------------------------------------

function isSlotLine(line: LyricLine | undefined): line is SlotLine {
  return !!line && isLinked(line) && line.templateLineIdx !== undefined && !line.detached;
}

const slotKey = (groupId: string, idx: number, slot: number) => `${instanceKey(groupId, idx)}\u0000${slot}`;

function copySources(input: CopyInput, groups: ReadonlyMap<string, LinkGroup>): SlotLine[] {
  const beforeById = new Map(input.before.map((line) => [line.id, line]));
  const afterById = new Map(input.after.map((line) => [line.id, line]));
  return [...new Set(input.touched)].flatMap((id) => {
    const line = afterById.get(id);
    if (!isSlotLine(line) || !sharesTiming(groups.get(line.groupId), line.instanceIdx)) return [];
    return timingChanged(beforeById.get(id), line) ? [line] : [];
  });
}

// Instances in the order they first appear in the song.
function instanceOrder(doc: LyricDoc): Map<string, number> {
  const order = new Map<string, number>();
  for (const item of doc.body) if (isInstanceSpan(item) && !order.has(item.key)) order.set(item.key, order.size);
  return order;
}

function sourceTemplateLine(doc: LyricDoc, source: SlotLine, at: number): TemplateLine | undefined {
  const instance = doc.instances[instanceKey(source.groupId, source.instanceIdx)];
  const template = doc.templates[source.groupId]?.find((line) => line.slot === source.templateLineIdx);
  if (!instance || !template || instance.replaced?.[source.templateLineIdx]) return undefined;
  const renames = invertedIds(instance.ids?.[source.templateLineIdx] ?? {});
  return toTemplateLine(withLineIds(lineContent(source), template.id, renames), source.templateLineIdx, at);
}

// -- Functions ----------------------------------------------------------------

// A timing edit in one shared instance is its group's template timing: it is written to the template, and every other
// shared instance takes the same timing and readings at its own anchor, on its own syllables. The first edited line of
// each template line wins, in song order. An edit that would take any instance out of the song is clamped, never refused.
function copyThroughTemplate(input: CopyInput): TemplateCopy {
  const { doc, after, anchors } = input;
  const result: TemplateCopy = {
    lines: after,
    copiedGroupIds: [],
    templates: new Map(),
    sources: new Map(),
  };
  if (!input.groups.some((group) => group.sharesTiming)) return result;
  const groups = new Map(input.groups.map((group) => [group.id, group]));
  const edited = copySources(input, groups);
  if (edited.length === 0) return result;
  const order = instanceOrder(doc);
  const rank = (line: SlotLine) => order.get(instanceKey(line.groupId, line.instanceIdx)) ?? order.size;
  const sources = edited.toSorted((a, b) => rank(a) - rank(b));

  const indexBySlot = new Map<string, number>();
  after.forEach((line, index) => {
    if (isSlotLine(line)) indexBySlot.set(slotKey(line.groupId, line.instanceIdx, line.templateLineIdx), index);
  });
  const claimed = new Set<string>();
  const copied = new Set<string>();
  let lines = after;
  const beforeById = new Map(input.before.map((line) => [line.id, line]));
  // An instance the command edited to other content than the source keeps its own edit.
  const touched = new Set(input.touched);
  for (const edited of sources) {
    const { groupId, instanceIdx, templateLineIdx: slot } = edited;
    const claim = `${groupId}\u0000${slot}`;
    if (claimed.has(claim)) continue;
    claimed.add(claim);
    const groupAnchors = anchors(groupId);
    const sourceAt = groupAnchors?.get(instanceIdx);
    if (sourceAt === undefined || !groupAnchors) continue;
    const offsets = [...groupAnchors].flatMap(([idx, at]) =>
      idx !== instanceIdx && sharesTiming(groups.get(groupId), idx) && indexBySlot.has(slotKey(groupId, idx, slot))
        ? [at - sourceAt]
        : [],
    );
    const clamped = clampedToRoom(beforeById.get(edited.id), edited, offsets, input.songEnd);
    const source: SlotLine = clamped === edited ? edited : { ...edited, tracks: clamped.tracks };
    const sourceIndex = indexBySlot.get(slotKey(groupId, instanceIdx, slot));
    if (source !== edited && sourceIndex !== undefined) {
      if (lines === after) lines = [...after];
      lines[sourceIndex] = source;
    }
    const templateLine = sourceTemplateLine(doc, source, sourceAt);
    if (templateLine) {
      const template = result.templates.get(groupId) ?? doc.templates[groupId] ?? [];
      result.templates.set(
        groupId,
        template.map((line) => (line.slot === slot ? templateLine : line)),
      );
      if (!result.sources.has(groupId)) result.sources.set(groupId, instanceIdx);
    }
    for (const [idx, at] of groupAnchors) {
      const index = indexBySlot.get(slotKey(groupId, idx, slot));
      if (idx === instanceIdx || index === undefined || !sharesTiming(groups.get(groupId), idx)) continue;
      const target = lines[index];
      if (touched.has(target.id) && !sameSharedContent(target, source)) continue;
      const updates = offsetTimingFields(source, at - sourceAt, target);
      const line = { ...target, ...updates };
      if (!timingChanged(target, line) && line.languages === target.languages) continue;
      if (lines === after) lines = [...after];
      lines[index] = line;
      copied.add(groupId);
    }
  }
  return { ...result, lines, copiedGroupIds: [...copied] };
}

// -- Exports ------------------------------------------------------------------

export type { InstanceAnchors, TemplateCopy };
export { copyThroughTemplate, instanceAnchors };
