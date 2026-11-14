import { validateLine } from "insync/validate-line";
import { readAlignedTimings, timingFingerprint, v3TimingFingerprint } from "@/domain/alignment/fingerprint";
import { migrateLegacyTransliterationLine } from "@/domain/language/migrate";
import { withSeededBackground } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { backgroundTrack, timedSyllables } from "@/domain/line/track";
import { timingGranularityOf } from "@/domain/project/timing-granularity";
import { linesFromSaved, type SavedProjectV3, upgradeSavedProject } from "@/lib/saved-project";
import { linesFromSavedV3 } from "@/lib/saved-project-v3";
import { compareExports, type ExportDifference } from "@/test/export-equality";
import { withPositionIds, withTimesInWholeMs } from "@/test/saved-format-equality";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

interface UpgradeReport {
  name: string;
  lines: number;
  // Lines whose v4 load is not the v3 load with times in whole ms.
  changedLines: string[];
  invalidLines: string[];
  exports: ExportDifference[];
  lrcTolerated: number;
  lrcExtraTags: number;
  // Lines marked aligned before the upgrade that read as unaligned after it.
  unaligned: string[];
  lineSyncedBackgroundsInWordProjects: number;
}

// -- Checks -------------------------------------------------------------------

// The lines 3.x read from a record with its own reader.
function linesAsV3Opened(record: SavedProjectV3): LyricLine[] {
  const loaded = linesFromSavedV3(record.lines);
  return record.version < 3 ? loaded.map(migrateLegacyTransliterationLine) : loaded;
}

function lineSyncedBackgrounds(lines: readonly LyricLine[]): number {
  if (timingGranularityOf(lines) !== "word") return 0;
  return lines.filter((line) => {
    const background = backgroundTrack(line);
    return background !== undefined && isLineSynced(line) && timedSyllables(background).length === 0;
  }).length;
}

function unalignedAfterUpgrade(record: SavedProjectV3, before: LyricLine[], after: LyricLine[], rekeyed: unknown) {
  const aligned = readAlignedTimings(record.alignedTimings);
  const now = readAlignedTimings(rekeyed);
  return before.flatMap((line, index) =>
    aligned[line.id] === v3TimingFingerprint(withSeededBackground(line)) &&
    now[line.id] !== timingFingerprint(withSeededBackground(after[index]))
      ? [line.id]
      : [],
  );
}

// A v3 record upgraded to v4 opens to the same lines, valid, and exports the same within one millisecond.
function checkUpgrade(name: string, record: SavedProjectV3): UpgradeReport {
  const before = linesAsV3Opened(record);
  const upgraded = upgradeSavedProject(structuredClone(record));
  const after = linesFromSaved(upgraded.lines);
  const expected = withPositionIds(withTimesInWholeMs(before));
  const actual = withPositionIds(after);
  const project = { name, groups: record.groups ?? [], agents: record.agents, metadata: record.metadata };
  const exports = compareExports(
    { ...project, lines: before.map(withSeededBackground) },
    { ...project, lines: after.map(withSeededBackground) },
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
    lineSyncedBackgroundsInWordProjects: lineSyncedBackgrounds(before),
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
