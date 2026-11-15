import { docFromFlatLines, type GroupHint, readGroup } from "@/domain/group/doc-from-flat-lines";
import { flattenBody, withFlatLines } from "@/domain/group/flatten";
import { type BodyItem, isInstance, type LyricDoc, type TemplateLine } from "@/domain/group/model";
import type { LinkGroup } from "@/domain/group/template";
import { copyThroughTemplate, type TemplateCopy } from "@/domain/group/template-copy";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

interface FoldInput {
  doc: LyricDoc;
  after: LyricLine[];
  touched: readonly string[];
  groups: readonly LinkGroup[];
  copiesSharedTiming: boolean;
}

interface Folded {
  lines: LyricLine[];
  doc: LyricDoc;
  rejected: boolean;
  copiedGroupIds: readonly string[];
}

// -- Helpers ------------------------------------------------------------------

function sameMembership(a: LyricLine, b: LyricLine): boolean {
  return (
    a.id === b.id &&
    a.groupId === b.groupId &&
    a.instanceIdx === b.instanceIdx &&
    a.templateLineIdx === b.templateLineIdx
  );
}

function hintsOf(doc: LyricDoc, copy: TemplateCopy | null): Map<string, GroupHint> {
  const hints = new Map<string, GroupHint>();
  for (const [groupId, template] of Object.entries(doc.templates)) {
    hints.set(groupId, {
      template: copy?.templates.get(groupId) ?? template,
      preferredIdx: copy?.sources.get(groupId),
      anchors: copy?.anchors.get(groupId) ?? storedAnchors(doc, groupId),
    });
  }
  return hints;
}

function storedAnchors(doc: LyricDoc, groupId: string): Map<number, number> {
  const anchors = new Map<number, number>();
  for (const item of doc.body)
    if (isInstance(item) && item.groupId === groupId && item.at !== undefined) {
      anchors.set(item.idx, item.at);
    }
  return anchors;
}

interface PlacedInstance {
  index: number;
  groupId: string;
  idx: number;
  start: number;
  count: number;
}

// The body with changed plain lines in place and the groups that have a changed line; null when a line moved, came or
// went, which reads the whole doc again.
function changedInPlace(doc: LyricDoc, before: readonly LyricLine[], after: readonly LyricLine[]) {
  if (before.length !== after.length) return null;
  const changedGroups = new Set<string>();
  const placed: PlacedInstance[] = [];
  const body: BodyItem[] = [];
  let start = 0;
  for (const [index, item] of doc.body.entries()) {
    const count = isInstance(item) ? Object.keys(item.lineIds).length : 1;
    for (let position = start; position < start + count; position++) {
      if (after[position] === before[position]) continue;
      if (!sameMembership(after[position], before[position])) return null;
      if (isInstance(item)) changedGroups.add(item.groupId);
    }
    if (isInstance(item)) placed.push({ index, groupId: item.groupId, idx: item.idx, start, count });
    body.push(isInstance(item) ? item : after[start]);
    start += count;
  }
  return { body, placed: placed.filter((instance) => changedGroups.has(instance.groupId)), changedGroups };
}

function withGroupsRead(
  doc: LyricDoc,
  inPlace: NonNullable<ReturnType<typeof changedInPlace>>,
  after: readonly LyricLine[],
  hints: ReadonlyMap<string, GroupHint>,
): LyricDoc {
  const templates: Record<string, readonly TemplateLine[]> = { ...doc.templates };
  const body = [...inPlace.body];
  for (const groupId of inPlace.changedGroups) {
    const runs = inPlace.placed
      .filter((instance) => instance.groupId === groupId)
      .map((instance) => ({ ...instance, lines: after.slice(instance.start, instance.start + instance.count) }));
    const read = readGroup(runs, hints.get(groupId));
    templates[groupId] = read.template;
    runs.forEach((run, order) => {
      body[run.index] = read.instances[order];
    });
  }
  return { body, templates };
}

// -- Functions ----------------------------------------------------------------

// Command output back into the doc: shared timing edits write the template, and every changed instance is read again
// against it. Work grows with the groups a command touched, never with the song.
function foldLines({ doc, after, touched, groups, copiesSharedTiming }: FoldInput): Folded {
  const before = flattenBody(doc);
  const copy = copiesSharedTiming ? copyThroughTemplate(doc, before, after, groups, touched) : null;
  if (copy?.rejected) return { lines: before, doc, rejected: true, copiedGroupIds: [] };
  const lines = copy?.lines ?? after;
  if (lines === before) return { lines, doc, rejected: false, copiedGroupIds: [] };
  const hints = hintsOf(doc, copy);
  const inPlace = changedInPlace(doc, before, lines);
  const folded = inPlace
    ? withFlatLines(withGroupsRead(doc, inPlace, lines, hints), lines)
    : docFromFlatLines(lines, hints);
  return { lines, doc: folded, rejected: false, copiedGroupIds: copy?.copiedGroupIds ?? [] };
}

// -- Exports ------------------------------------------------------------------

export { foldLines };
