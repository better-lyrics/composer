import { withRoleWords } from "insync/line-track-writes";
import { roleWords } from "insync/line-track";
import { joinsFromWords, syllablesFromWords } from "insync/from-words";
import { wordsFromSyllables } from "insync/to-words";
import { describe, expect, it } from "vitest";
import { languageSourceFingerprint } from "insync/language-fingerprint";
import { withoutV3Piece } from "insync/language-v3-languages";
import type { LyricLine } from "insync/line";
import { spacedFromWords, wordsFromSpaced } from "insync/word-spaced-words";
import type { WordTiming } from "insync/word-timing";
import { useProjectStore } from "@/stores/project";
import type { SavedProjectV3 } from "@/lib/saved-project";
import { REAL_PROJECT_FILES, realStoredRecords } from "@/test/real-records";
import { checkTemplateMigration, migrationStops, migrationTotals } from "@/test/template-migration-check";
import { checkUpgrade, hasProblems } from "@/test/upgrade-check";
import { linesFromSavedV3, type SavedLineV3 } from "@/lib/saved-project-v3";
import { savedLinesV3 } from "@/test/saved-v3";
import { EDITED_TTML_PROJECTS, type EditedTtmlProject } from "@/test/edited-ttml-projects";
import { legacyLine } from "@/test/legacy-languages";
import {
  buildAlternateBackgroundLanguageTtml,
  buildAlternateLanguageTtml,
  buildBackgroundVocalTtml,
  buildMatchingAlternateLanguageTtml,
  buildSyncedTtml,
} from "@/test/ttml-fixtures";
import { parseTtml } from "insync/ttml/read";
import { stripSplitCharacter } from "@/utils/split-character";
import { generateProjectTtml } from "insync/ttml/write";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Constants ----------------------------------------------------------------

const EXPORT_DURATION_SECONDS = 30;

const TTML_FIXTURES: readonly (() => string)[] = [
  () => buildSyncedTtml(EXPORT_DURATION_SECONDS),
  buildBackgroundVocalTtml,
  buildAlternateLanguageTtml,
  buildAlternateBackgroundLanguageTtml,
  buildMatchingAlternateLanguageTtml,
];

// -- Helpers ------------------------------------------------------------------

function projectFromTtml(ttml: string): EditedTtmlProject {
  const { metadata, agents } = useProjectStore.getState();
  const parsed = parseTtml(ttml, DEFAULT_SPLIT_CHARACTER);
  return { name: "ttml fixture", lines: parsed.lines, groups: parsed.groups ?? [], agents, metadata };
}

function fixtureProjects(): EditedTtmlProject[] {
  return [...EDITED_TTML_PROJECTS.map((build) => build()), ...TTML_FIXTURES.map((build) => projectFromTtml(build()))];
}

interface SavedRecord {
  name: string;
  lines: SavedLineV3[];
}

function realRecords(): SavedRecord[] {
  return realStoredRecords().map(({ name, record }) => ({ name, lines: record.lines as SavedLineV3[] }));
}

// The load before split marks were restored, so real exports are compared with what 3.x exported.
function linesLoadedAsSaved(lines: readonly SavedLineV3[]): LyricLine[] {
  const storeWords = (words: SavedLineV3["words"]) => {
    if (!words) return undefined;
    const timed = wordsFromSpaced(words.map(({ id: _id, ...word }) => withoutV3Piece(word)));
    return timed.map((word, index) => {
      const { transliteration, transliterationJoinerAfter } = words[index];
      return { ...word, transliteration, transliterationJoinerAfter };
    });
  };
  return lines.map(({ words, backgroundWords, ...fields }) =>
    legacyLine({
      ...fields,
      words: storeWords(words),
      ...(backgroundWords && { backgroundWords: storeWords(backgroundWords) }),
    }),
  );
}

function realProjects(): EditedTtmlProject[] {
  return realStoredRecords().map(({ name, record }) => ({
    name,
    lines: linesLoadedAsSaved(record.lines as SavedLineV3[]),
    groups: record.groups ?? [],
    agents: record.agents,
    metadata: record.metadata,
  }));
}

function expectRoundTripKeepsExport(projects: readonly EditedTtmlProject[]): void {
  for (const project of projects) {
    const before = exportOf(project);
    const after = exportOf({ ...project, lines: project.lines.map(throughSyllables) });
    expect(after, project.name).toBe(before);
  }
}

function wordsThroughSyllables(words: readonly WordTiming[]): WordTiming[] {
  const track = syllablesFromWords(spacedFromWords(words));
  const roundTripped = wordsFromSpaced(wordsFromSyllables(track));
  expect(roundTripped).toHaveLength(words.length);
  expect(syllablesFromWords(spacedFromWords(roundTripped)).map((syllable) => syllable.joinsNext)).toEqual(
    track.map((syllable) => syllable.joinsNext),
  );
  return words.map((word, index) => ({ ...word, ...roundTripped[index], id: word.id }));
}

function throughSyllables(line: LyricLine): LyricLine {
  const main = roleWords(line, "main");
  const background = roleWords(line, "bg");
  const withMain = main ? withRoleWords(line, "main", wordsThroughSyllables(main)) : line;
  return background ? withRoleWords(withMain, "bg", wordsThroughSyllables(background)) : withMain;
}

function withoutGroupIds(line: SavedLineV3): SavedLineV3 {
  const strip = (words: SavedLineV3["words"]) => words?.map(({ syllableGroupId: _id, ...word }) => word);
  return {
    ...line,
    ...(line.words && { words: strip(line.words) }),
    ...(line.backgroundWords && { backgroundWords: strip(line.backgroundWords) }),
  };
}

// Saved ids are rewritten one per word run, so a reload must read the same joins the record spelled.
function expectSameJoins(resaved: SavedLineV3, saved: SavedLineV3, name: string): void {
  for (const track of ["words", "backgroundWords"] as const) {
    const before = saved[track] ?? [];
    const after = resaved[track] ?? [];
    expect(joinsFromWords(after), name).toEqual(joinsFromWords(before));
    if (!before.some((word) => word.syllableGroupId !== undefined)) {
      expect(
        after.some((word) => word.syllableGroupId !== undefined),
        name,
      ).toBe(false);
    }
  }
}

interface LoadCounts {
  repaired: number;
  leadingSpaceDropped: number;
}

const startsWithSpace = (text: string | undefined) => text !== undefined && text !== text.trimStart();

// A load may only put back syllable marks: everything else, the language fingerprint and the export stay.
function expectSaveAndLoadKeepEverything(project: EditedTtmlProject, record: SavedRecord): LoadCounts {
  const storeLines = linesFromSavedV3(record.lines);
  const resaved = savedLinesV3(storeLines);
  expect(savedLinesV3(linesFromSavedV3(resaved)), record.name).toEqual(resaved);
  let repaired = 0;
  let leadingSpaceDropped = 0;
  resaved.forEach((line, index) => {
    const saved = record.lines[index];
    if (startsWithSpace(saved.text) && !startsWithSpace(line.text)) leadingSpaceDropped++;
    expect(withoutGroupIds({ ...line, text: saved.text, backgroundText: saved.backgroundText }), record.name).toEqual(
      withoutGroupIds(saved),
    );
    expectSameJoins(line, saved, record.name);
    expect(stripSplitCharacter(line.text), record.name).toBe(stripSplitCharacter(saved.text));
    expect(stripSplitCharacter(line.backgroundText ?? ""), record.name).toBe(
      stripSplitCharacter(saved.backgroundText ?? ""),
    );
    expect(languageSourceFingerprint(DEFAULT_SPLIT_CHARACTER, line.text, line.backgroundText), record.name).toBe(
      languageSourceFingerprint(DEFAULT_SPLIT_CHARACTER, saved.text, saved.backgroundText),
    );
    if (line.text !== saved.text || line.backgroundText !== saved.backgroundText) repaired++;
  });
  expect(exportOf({ ...project, lines: storeLines }), record.name).toBe(exportOf(project));
  return { repaired, leadingSpaceDropped };
}

function v3Record({ metadata, agents, groups }: EditedTtmlProject): SavedProjectV3 {
  return { version: 3, savedAt: 0, metadata, agents, groups, granularity: "word", lines: [] };
}

function exportOf(project: EditedTtmlProject): string {
  return generateProjectTtml(project, EXPORT_DURATION_SECONDS, DEFAULT_SPLIT_CHARACTER);
}

// -- Tests --------------------------------------------------------------------

describe("insync export equality", () => {
  it("syllable round trip keeps every exported byte", () => {
    const projects = fixtureProjects();
    expect(projects.every((project) => exportOf(project) !== "")).toBe(true);
    expectRoundTripKeepsExport(projects);
  });

  it("a v3 save and load keeps every word and exported byte", () => {
    for (const project of fixtureProjects()) {
      expectSaveAndLoadKeepEverything(project, { name: project.name, lines: savedLinesV3(project.lines) });
    }
  });

  it.runIf(REAL_PROJECT_FILES.length > 0)("a v3 save and load keeps real projects", () => {
    const records = realRecords();
    const projects = realProjects();
    expect(records.length).toBeGreaterThan(0);
    const counts = records.map((record, index) => expectSaveAndLoadKeepEverything(projects[index], record));
    const total = (key: keyof LoadCounts) => counts.reduce((sum, count) => sum + count[key], 0);
    console.info(`[insync] lines with restored syllable marks: ${total("repaired")}`);
    console.info(`[insync] lines whose leading whitespace was dropped: ${total("leadingSpaceDropped")}`);
    expect(total("leadingSpaceDropped")).toBe(0);
  });

  it.runIf(REAL_PROJECT_FILES.length > 0)("syllable round trip keeps the export of real projects", () => {
    const projects = realProjects();
    expect(projects.length).toBeGreaterThan(0);
    expectRoundTripKeepsExport(projects);
  });

  it("a v3 record upgraded to v4 opens and exports the same", () => {
    const reports = fixtureProjects().map((project) =>
      checkUpgrade(project.name, { ...v3Record(project), lines: savedLinesV3(project.lines) }),
    );
    expect(reports.filter(hasProblems)).toEqual([]);
  });

  it.runIf(REAL_PROJECT_FILES.length > 0)("real v3 records upgraded to v4 open and export the same", () => {
    const records = realStoredRecords().flatMap(({ name, record }) => (record.version < 4 ? [{ name, record }] : []));
    expect(records.length).toBeGreaterThan(0);
    const reports = records.map(({ name, record }) => checkUpgrade(name, record as SavedProjectV3));
    const lines = reports.reduce((sum, report) => sum + report.lines, 0);
    const excluded = reports.reduce((sum, report) => sum + report.excludedFromExports, 0);
    console.info(`[insync] v3 to v4: ${reports.length} projects, ${lines} lines`);
    console.info(`[insync] line-synced lines with an untimed background, left out of the export check: ${excluded}`);
    const drifted = reports.reduce((sum, report) => sum + report.instanceDrift.offTemplate, 0);
    const instances = reports.reduce((sum, report) => sum + report.instanceDrift.compared, 0);
    console.info(`[insync] shared instances 1 to 10 ms off their template: ${drifted} of ${instances}`);
    const lrcTolerated = reports.reduce((sum, report) => sum + report.lrcTolerated, 0);
    const lrcExtraTags = reports.reduce((sum, report) => sum + report.lrcExtraTags, 0);
    console.info(
      `[insync] LRC values moved by one centisecond: ${lrcTolerated}, inline tags repeating a time: ${lrcExtraTags}`,
    );
    const problems = reports.filter(hasProblems);
    if (problems.length > 0) console.info("[insync] v3 to v4 problems", JSON.stringify(problems, null, 2));
    expect(problems).toEqual([]);
  });

  it.runIf(REAL_PROJECT_FILES.length > 0)("real projects read as templates give back their lines and exports", () => {
    const reports = realStoredRecords().map(({ name, record }) => checkTemplateMigration(name, record));
    expect(reports.length).toBeGreaterThan(0);
    const totals = migrationTotals(reports);
    console.info(
      `[insync] templates: ${totals.projects} projects, ${totals.groups} groups, ${totals.instances} instances, ${totals.lines} lines (${totals.exactLines} exact)`,
    );
    console.info(`[insync] template fallbacks: ${JSON.stringify(totals.fallbacks)}`);
    console.info(
      `[insync] shared instances 1 to 10 ms off their template: ${totals.offTemplate} of ${totals.comparedInstances}`,
    );
    for (const { name, fallbacks } of reports.filter((report) => Object.values(report.fallbacks).some(Boolean))) {
      console.info(`[insync] template fallbacks in ${name}: ${JSON.stringify(fallbacks)}`);
    }
    const stops = reports.filter(migrationStops);
    if (stops.length > 0) console.info("[insync] template problems", JSON.stringify(stops, null, 2));
    expect(stops).toEqual([]);
  });
});
