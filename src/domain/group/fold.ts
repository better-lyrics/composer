import { docAfterLines, type GroupHint } from "@/domain/group/doc-from-flat-lines";
import { flattenBody } from "@/domain/group/flatten";
import type { LyricDoc } from "@/domain/group/model";
import type { LinkGroup } from "@/domain/group/template";
import {
  copyThroughTemplate,
  type InstanceAnchors,
  instanceAnchors,
  type TemplateCopy,
} from "@/domain/group/template-copy";
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

function sameElements(a: readonly LyricLine[], b: readonly LyricLine[]): boolean {
  return a === b || (a.length === b.length && a.every((line, index) => line === b[index]));
}

// Groups with a line that came, went or changed. A line that only moved keeps its group as it was.
function changedGroupIds(before: readonly LyricLine[], after: readonly LyricLine[]): Set<string> {
  const changed = new Set<string>();
  const add = (line: LyricLine) => {
    if (line.groupId !== undefined) changed.add(line.groupId);
  };
  if (before.length === after.length) {
    for (let index = 0; index < after.length; index++) {
      if (after[index] === before[index]) continue;
      add(after[index]);
      add(before[index]);
    }
    return changed;
  }
  const beforeLines = new Set(before);
  const afterLines = new Set(after);
  for (const line of after) if (!beforeLines.has(line)) add(line);
  for (const line of before) if (!afterLines.has(line)) add(line);
  return changed;
}

function hintsOf(
  doc: LyricDoc,
  changed: ReadonlySet<string>,
  copy: TemplateCopy | null,
  anchors: InstanceAnchors,
): Map<string, GroupHint> {
  const hints = new Map<string, GroupHint>();
  for (const groupId of changed) {
    hints.set(groupId, {
      template: copy?.templates.get(groupId) ?? doc.templates[groupId],
      preferredIdx: copy?.sources.get(groupId),
      anchors: anchors(groupId),
    });
  }
  return hints;
}

// -- Functions ----------------------------------------------------------------

// Command output back into the doc: shared timing edits write the template and reach every shared instance, and only
// the groups whose lines changed are read again. Work grows with the lines and groups a command touched.
function foldLines({ doc, after, touched, groups, copiesSharedTiming }: FoldInput): Folded {
  const before = flattenBody(doc);
  const anchors = instanceAnchors(doc);
  const copy = copiesSharedTiming ? copyThroughTemplate({ doc, before, after, groups, touched, anchors }) : null;
  if (copy?.rejected) return { lines: before, doc, rejected: true, copiedGroupIds: [] };
  const output = copy?.lines ?? after;
  const lines = sameElements(output, before) ? before : output;
  if (lines === before) return { lines, doc, rejected: false, copiedGroupIds: [] };
  const changed = changedGroupIds(before, lines);
  const folded = docAfterLines(doc, lines, changed, hintsOf(doc, changed, copy, anchors));
  return { lines, doc: folded, rejected: false, copiedGroupIds: copy?.copiedGroupIds ?? [] };
}

// -- Exports ------------------------------------------------------------------

export { foldLines };
