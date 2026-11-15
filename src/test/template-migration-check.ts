import { docFromFlatLines } from "@/domain/group/doc-from-flat-lines";
import { flattenBody } from "@/domain/group/flatten";
import { isInstanceSpan, type LyricDoc } from "insync/group";
import { sameToTheMs } from "@/domain/group/read-instance";
import type { LyricLine } from "insync/line";
import { linesFromSaved, type StoredProject, upgradeSavedProject } from "@/lib/saved-project";
import { compareExports, type ExportDifference } from "@/test/export-equality";
import { type InstanceDrift, sharedInstanceDrift } from "@/test/shared-instance-drift";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { DEFAULT_SPLIT_CHARACTER } from "@/utils/split-character-text";

// -- Types --------------------------------------------------------------------

// Where the template could not hold an instance exactly. Lines, except `ownTiming`, which counts instances.
interface MigrationFallbacks {
  replaced: number;
  ownTiming: number;
  // Group lines kept as plain lines, and lines of instances spread over several spans or out of slot order.
  loose: number;
  detached: number;
  // Lines the doc does not give back to the millisecond.
  lossy: number;
}

interface TemplateMigrationReport {
  name: string;
  groups: number;
  instances: number;
  // Lines the doc gives back with every value equal, not only within a millisecond.
  exactLines: number;
  lines: number;
  fallbacks: MigrationFallbacks;
  lossyLines: string[];
  exports: ExportDifference[];
  instanceDrift: InstanceDrift;
}

// -- Counting -----------------------------------------------------------------

function looseLines(doc: LyricDoc): number {
  const spansByInstance = new Map<string, number[][]>();
  let loose = 0;
  for (const item of doc.body) {
    if (!isInstanceSpan(item)) {
      if (item.groupId !== undefined) loose++;
      continue;
    }
    spansByInstance.set(item.key, [...(spansByInstance.get(item.key) ?? []), [...item.slots]]);
  }
  for (const spans of spansByInstance.values()) {
    const slots = spans.flat();
    const inOrder = slots.every((slot, index) => index === 0 || slot > slots[index - 1]);
    if (spans.length > 1 || !inOrder) loose += slots.length;
  }
  return loose;
}

function fallbacksOf(doc: LyricDoc, lossy: number): MigrationFallbacks {
  const instances = Object.values(doc.instances);
  const replacedLines = instances.flatMap((instance) => Object.values(instance.replaced ?? {}));
  return {
    replaced: replacedLines.filter((line) => !line.detached).length,
    ownTiming: instances.filter((instance) => instance.ownTiming).length,
    loose: looseLines(doc),
    detached: replacedLines.filter((line) => line.detached).length,
    lossy,
  };
}

// -- Check --------------------------------------------------------------------

// A record opened as flat lines and as a doc: the doc flattens back to the lines and exports the same. The doc is
// cloned before flattening so no line object is handed back from the read.
function checkTemplateMigration(name: string, record: StoredProject): TemplateMigrationReport {
  const flat: LyricLine[] = linesFromSaved(upgradeSavedProject(structuredClone(record)).lines);
  const doc = docFromFlatLines(flat, DEFAULT_SPLIT_CHARACTER);
  const fromTemplate = flattenBody(structuredClone(doc));
  const lossyLines = flat.flatMap((line, index) => (sameToTheMs(fromTemplate[index], line) ? [] : [line.id]));
  if (fromTemplate.length !== flat.length) lossyLines.push(`line count ${flat.length} to ${fromTemplate.length}`);
  const groups = record.groups ?? [];
  const project = { name, groups, agents: record.agents, metadata: record.metadata };
  return {
    name,
    groups: new Set(Object.values(doc.instances).map((instance) => instance.groupId)).size,
    instances: Object.keys(doc.instances).length,
    exactLines: flat.filter((line, index) => isStructurallyEqual(fromTemplate[index], line)).length,
    lines: flat.length,
    fallbacks: fallbacksOf(doc, lossyLines.length),
    lossyLines,
    exports: compareExports({ ...project, lines: flat }, { ...project, lines: fromTemplate }).differences,
    instanceDrift: sharedInstanceDrift(flat, groups),
  };
}

function migrationTotals(reports: readonly TemplateMigrationReport[]) {
  const sum = (count: (report: TemplateMigrationReport) => number) =>
    reports.reduce((total, report) => total + count(report), 0);
  const fallbacks = Object.fromEntries(
    (["replaced", "ownTiming", "loose", "detached", "lossy"] as const).map((reason) => [
      reason,
      sum((report) => report.fallbacks[reason]),
    ]),
  );
  return {
    projects: reports.length,
    groups: sum((report) => report.groups),
    instances: sum((report) => report.instances),
    lines: sum((report) => report.lines),
    exactLines: sum((report) => report.exactLines),
    fallbacks,
    offTemplate: sum((report) => report.instanceDrift.offTemplate),
    comparedInstances: sum((report) => report.instanceDrift.compared),
  };
}

function migrationStops(report: TemplateMigrationReport): boolean {
  return report.lossyLines.length > 0 || report.exports.length > 0;
}

// -- Exports ------------------------------------------------------------------

export { checkTemplateMigration, migrationStops, migrationTotals };
