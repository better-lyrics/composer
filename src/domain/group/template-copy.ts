import { instanceSlotLine } from "@/domain/group/flatten";
import { invertedIds, withLineIds } from "@/domain/group/line-ids";
import { instanceSlots, isInstanceSpan, type LyricDoc, type TemplateLine } from "@/domain/group/model";
import { hasNegativeTime, offsetTimingFields } from "@/domain/group/offset-timing";
import { sharesTiming, timingChanged } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { lineContent, toTemplateLine } from "@/domain/group/template-line";
import { instanceBounds } from "@/domain/instance/bounds";
import { instanceKey } from "@/domain/instance/key";
import { isLinked, type LinkedLine } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

// Each instance's anchor, by group and instance index.
type InstanceAnchors = ReadonlyMap<string, ReadonlyMap<number, number>>;

interface CopyInput {
  doc: LyricDoc;
  before: readonly LyricLine[];
  after: LyricLine[];
  groups: readonly LinkGroup[];
  touched: readonly string[];
  anchors: InstanceAnchors;
}

interface TemplateCopy {
  lines: LyricLine[];
  rejected: boolean;
  copiedGroupIds: string[];
  // Per group: the template the copies came from and the instance that wrote it.
  templates: Map<string, readonly TemplateLine[]>;
  sources: Map<string, number>;
}

type SlotLine = LinkedLine & { templateLineIdx: number };

// -- Anchors ------------------------------------------------------------------

// An instance's anchor is where its template is placed, or its first time when it keeps its own.
function instanceAnchors(doc: LyricDoc): InstanceAnchors {
  const anchors = new Map<string, Map<number, number>>();
  for (const instance of Object.values(doc.instances)) {
    const lines = instanceSlots(instance).flatMap((slot) => instanceSlotLine(doc, instance, slot) ?? []);
    const at = instance.at ?? instanceBounds(lines.filter((line) => !line.detached))?.begin;
    if (at === undefined) continue;
    const byIdx = anchors.get(instance.groupId) ?? new Map<number, number>();
    byIdx.set(instance.idx, at);
    anchors.set(instance.groupId, byIdx);
  }
  return anchors;
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
// each template line wins, in song order.
function copyThroughTemplate(input: CopyInput): TemplateCopy {
  const { doc, after, anchors } = input;
  const result: TemplateCopy = {
    lines: after,
    rejected: false,
    copiedGroupIds: [],
    templates: new Map(),
    sources: new Map(),
  };
  if (!input.groups.some((group) => group.sharesTiming)) return result;
  const groups = new Map(input.groups.map((group) => [group.id, group]));
  const order = instanceOrder(doc);
  const rank = (line: SlotLine) => order.get(instanceKey(line.groupId, line.instanceIdx)) ?? order.size;
  const sources = copySources(input, groups).toSorted((a, b) => rank(a) - rank(b));
  if (sources.length === 0) return result;

  const indexBySlot = new Map<string, number>();
  after.forEach((line, index) => {
    if (isSlotLine(line)) indexBySlot.set(slotKey(line.groupId, line.instanceIdx, line.templateLineIdx), index);
  });
  const claimed = new Set<string>();
  const copied = new Set<string>();
  let lines = after;
  for (const source of sources) {
    const { groupId, instanceIdx, templateLineIdx: slot } = source;
    const claim = `${groupId}\u0000${slot}`;
    if (claimed.has(claim)) continue;
    claimed.add(claim);
    const groupAnchors = anchors.get(groupId);
    const sourceAt = groupAnchors?.get(instanceIdx);
    if (sourceAt === undefined || !groupAnchors) continue;
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
      const updates = offsetTimingFields(source, at - sourceAt, target);
      if (hasNegativeTime(updates)) return { ...result, lines: after, rejected: true };
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
