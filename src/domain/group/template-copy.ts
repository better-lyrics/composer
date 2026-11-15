import { instanceLines, templateSlotLine } from "@/domain/group/flatten";
import { invertedIds, withLineIds } from "@/domain/group/line-ids";
import { type Instance, isInstance, type LyricDoc, type TemplateLine } from "@/domain/group/model";
import { hasNegativeTime, offsetTimingFields } from "@/domain/group/offset-timing";
import { sharesTiming, timingChanged } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { lineContent, toTemplateLine } from "@/domain/group/template-line";
import { instanceBounds } from "@/domain/instance/bounds";
import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

interface TemplateCopy {
  lines: LyricLine[];
  rejected: boolean;
  copiedGroupIds: string[];
  // Per group: the template the copies came from and the instance that wrote it.
  templates: Map<string, readonly TemplateLine[]>;
  sources: Map<string, number>;
  anchors: Map<string, Map<number, number>>;
}

interface Source {
  line: LyricLine;
  instance: Instance;
  slot: number;
  order: number;
}

// -- Anchors ------------------------------------------------------------------

function anchorsOf(doc: LyricDoc): Map<string, Map<number, number>> {
  const anchors = new Map<string, Map<number, number>>();
  for (const item of doc.body) {
    if (!isInstance(item)) continue;
    const lines = instanceLines(item, doc.templates[item.groupId] ?? []).filter((line) => !line.detached);
    const at = item.at ?? instanceBounds(lines)?.begin;
    if (at === undefined) continue;
    const byIdx = anchors.get(item.groupId) ?? new Map<number, number>();
    byIdx.set(item.idx, at);
    anchors.set(item.groupId, byIdx);
  }
  return anchors;
}

// -- Sources ------------------------------------------------------------------

function copySources(
  doc: LyricDoc,
  before: readonly LyricLine[],
  after: readonly LyricLine[],
  groups: ReadonlyMap<string, LinkGroup>,
  touched: readonly string[],
): Source[] {
  const beforeById = new Map(before.map((line) => [line.id, line]));
  const afterById = new Map(after.map((line) => [line.id, line]));
  const instanceByLine = new Map<string, { instance: Instance; slot: number; order: number }>();
  doc.body.forEach((item, order) => {
    if (!isInstance(item)) return;
    for (const [slot, id] of Object.entries(item.lineIds))
      instanceByLine.set(id, { instance: item, slot: +slot, order });
  });
  const sources: Source[] = [];
  for (const id of new Set(touched)) {
    const line = afterById.get(id);
    const member = instanceByLine.get(id);
    if (!line || !member || !isLinked(line) || line.detached) continue;
    if (line.groupId !== member.instance.groupId || line.instanceIdx !== member.instance.idx) continue;
    if (!sharesTiming(groups.get(line.groupId), line.instanceIdx) || !timingChanged(beforeById.get(id), line)) continue;
    sources.push({ line, ...member });
  }
  return sources.toSorted((a, b) => a.order - b.order);
}

// -- Copies -------------------------------------------------------------------

function sourceTemplateLine(source: Source, template: readonly TemplateLine[], at: number): TemplateLine | undefined {
  const current = template.find((line) => line.slot === source.slot);
  if (!current || source.instance.replaced?.[source.slot]) return undefined;
  const renames = invertedIds(source.instance.ids?.[source.slot] ?? {});
  return toTemplateLine({ ...withLineIds(lineContent(source.line), current.id, renames) }, source.slot, at);
}

// A copy to a line the template gives is that template line at the instance's anchor; a line the instance holds itself
// takes the source's timing onto its own syllables.
function copiedLine(
  target: LyricLine,
  instance: Instance,
  slot: number,
  copy: { source: LyricLine; templateLine: TemplateLine | undefined; offset: number; at: number },
): LyricLine {
  if (copy.templateLine && !instance.replaced?.[slot]) {
    return templateSlotLine(copy.templateLine, { ...instance, at: copy.at, ownTiming: undefined });
  }
  return { ...target, ...offsetTimingFields(copy.source, copy.offset, target) };
}

// -- Functions ----------------------------------------------------------------

// A timing edit in one shared instance writes its group's template, and every shared instance follows it at its own
// anchor. The first edited line of each template line wins, in song order.
function copyThroughTemplate(
  doc: LyricDoc,
  before: readonly LyricLine[],
  after: LyricLine[],
  groupList: readonly LinkGroup[],
  touched: readonly string[],
): TemplateCopy {
  const result: TemplateCopy = {
    lines: after,
    rejected: false,
    copiedGroupIds: [],
    templates: new Map(),
    sources: new Map(),
    anchors: new Map(),
  };
  if (!groupList.some((group) => group.sharesTiming)) return result;
  const groups = new Map(groupList.map((group) => [group.id, group]));
  const sources = copySources(doc, before, after, groups, touched);
  if (sources.length === 0) return result;

  const anchors = anchorsOf(doc);
  result.anchors = anchors;
  const indexById = new Map(after.map((line, index) => [line.id, index]));
  const claimed = new Set<string>();
  const copied = new Set<string>();
  let lines = after;
  for (const source of sources) {
    const { groupId, idx } = source.instance;
    const claim = `${groupId}\u0000${source.slot}`;
    if (claimed.has(claim)) continue;
    claimed.add(claim);
    const sourceAt = anchors.get(groupId)?.get(idx);
    if (sourceAt === undefined) continue;
    const template = result.templates.get(groupId) ?? doc.templates[groupId] ?? [];
    const templateLine = sourceTemplateLine(source, template, sourceAt);
    if (templateLine) {
      result.templates.set(
        groupId,
        template.map((line) => (line.slot === source.slot ? templateLine : line)),
      );
      if (!result.sources.has(groupId)) result.sources.set(groupId, idx);
    }
    for (const item of doc.body) {
      if (!isInstance(item) || item.groupId !== groupId || item.idx === idx) continue;
      const targetId = item.lineIds[source.slot];
      const at = anchors.get(groupId)?.get(item.idx);
      const index = targetId === undefined ? undefined : indexById.get(targetId);
      if (!sharesTiming(groups.get(groupId), item.idx) || at === undefined || index === undefined) continue;
      const target = lines[index];
      if (target.detached || target.groupId !== groupId || target.instanceIdx !== item.idx) continue;
      const line = copiedLine(target, item, source.slot, {
        source: source.line,
        templateLine,
        offset: at - sourceAt,
        at,
      });
      if (hasNegativeTime({ tracks: line.tracks })) return { ...result, lines: after, rejected: true };
      if (isStructurallyEqual(line, target)) continue;
      if (lines === after) lines = [...after];
      lines[index] = line;
      copied.add(groupId);
    }
  }
  return { ...result, lines, copiedGroupIds: [...copied] };
}

// -- Exports ------------------------------------------------------------------

export type { TemplateCopy };
export { copyThroughTemplate };
