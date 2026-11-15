import { validateLine } from "insync/validate-line";
import { readAlignedTimings, timingFingerprint, v3TimingFingerprint } from "@/domain/alignment/fingerprint";
import { migrateLegacyTransliterationLine } from "insync/language-migrate";
import { withSeededBackground, withSeededBackgroundWords } from "insync/line-background";
import { bgBounds } from "insync/line-bounds";
import type { LyricLine } from "insync/line";
import { isLineSynced } from "insync/line-predicates";
import { backgroundTrack } from "insync/line-track";
import { linesFromSaved, type SavedProjectV3, upgradeSavedProject } from "@/lib/saved-project";
import { linesFromSavedV3 } from "@/lib/saved-project-v3";
import { compareExports, type ExportDifference } from "@/test/export-equality";
import { withPositionIds, withTimesInWholeMs } from "@/test/saved-format-equality";
import { type InstanceDrift, sharedInstanceDrift } from "@/test/shared-instance-drift";
import { isStructurallyEqual } from "insync/structural-equal";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Types --------------------------------------------------------------------

interface UpgradeReport {
  name: string;
  lines: number;
  // Lines whose v4 load is not the v3 load, seeded as every v3 open seeded it, with times in whole ms.
  changedLines: string[];
  invalidLines: string[];
  exports: ExportDifference[];
  lrcTolerated: number;
  lrcExtraTags: number;
  // Lines marked aligned before the upgrade that read as unaligned after it.
  unaligned: string[];
  // Line-synced lines with an untimed background: 3.x seeded and exported background words, now one span.
  excludedFromExports: number;
  instanceDrift: InstanceDrift;
}

// -- Checks -------------------------------------------------------------------

// The lines 3.x read from a record with its own reader.
function linesAsV3Opened(record: SavedProjectV3): LyricLine[] {
  const loaded = linesFromSavedV3(record.lines);
  return record.version < 3
    ? loaded.map((value) => migrateLegacyTransliterationLine(value, DEFAULT_SPLIT_CHARACTER))
    : loaded;
}

function seedsBackgroundSpan(line: LyricLine): boolean {
  return backgroundTrack(line) !== undefined && isLineSynced(line) && !bgBounds(line);
}

function unalignedAfterUpgrade(record: SavedProjectV3, before: LyricLine[], after: LyricLine[], rekeyed: unknown) {
  const aligned = readAlignedTimings(record.alignedTimings);
  const now = readAlignedTimings(rekeyed);
  return before.flatMap((line, index) =>
    aligned[line.id] === v3TimingFingerprint(withSeededBackgroundWords(line, DEFAULT_SPLIT_CHARACTER)) &&
    now[line.id] !== timingFingerprint(withSeededBackground(after[index], DEFAULT_SPLIT_CHARACTER))
      ? [line.id]
      : [],
  );
}

// A v3 record upgraded to v4 opens to the same lines, valid, and exports the same within one millisecond.
function checkUpgrade(name: string, record: SavedProjectV3): UpgradeReport {
  const before = linesAsV3Opened(record);
  const upgraded = upgradeSavedProject(structuredClone(record));
  const after = linesFromSaved(upgraded.lines);
  const expected = withPositionIds(
    withTimesInWholeMs(before.map((line) => withSeededBackground(line, DEFAULT_SPLIT_CHARACTER))),
  );
  const actual = withPositionIds(after);
  const project = { name, groups: record.groups ?? [], agents: record.agents, metadata: record.metadata };
  const excluded = new Set(before.flatMap((line, index) => (seedsBackgroundSpan(line) ? [index] : [])));
  const compared = (lines: LyricLine[]) => lines.filter((_line, index) => !excluded.has(index));
  const exports = compareExports(
    { ...project, lines: compared(before.map((value) => withSeededBackgroundWords(value, DEFAULT_SPLIT_CHARACTER))) },
    { ...project, lines: compared(after.map((value) => withSeededBackground(value, DEFAULT_SPLIT_CHARACTER))) },
  );
  return {
    name,
    lines: before.length,
    changedLines: before.flatMap((line, index) =>
      isStructurallyEqual(expected[index], actual[index]) ? [] : [line.id],
    ),
    invalidLines: upgraded.lines.flatMap((line) => (validateLine(line).errors.length > 0 ? [line.id] : [])),
    exports: exports.differences,
    lrcTolerated: exports.lrc.tolerated,
    lrcExtraTags: exports.lrc.extraTags,
    unaligned: unalignedAfterUpgrade(record, before, after, upgraded.alignedTimings),
    excludedFromExports: excluded.size,
    instanceDrift: sharedInstanceDrift(before, record.groups ?? []),
  };
}

function hasProblems(report: UpgradeReport): boolean {
  return (
    report.changedLines.length > 0 ||
    report.invalidLines.length > 0 ||
    report.exports.length > 0 ||
    report.unaligned.length > 0
  );
}

// -- Exports ------------------------------------------------------------------

export { checkUpgrade, hasProblems };
