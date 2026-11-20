import { syllablesFromWords } from "insync/from-words";
import { wordsFromSyllables } from "insync/to-words";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { spacedFromWords, wordsFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { parseProjectFileContents } from "@/lib/project-file-read";
import { type SavedLine, linesFromSaved, savedLines } from "@/lib/saved-project";
import { EDITED_TTML_PROJECTS, type EditedTtmlProject } from "@/test/edited-ttml-projects";
import {
  buildAlternateBackgroundLanguageTtml,
  buildAlternateLanguageTtml,
  buildBackgroundVocalTtml,
  buildMatchingAlternateLanguageTtml,
  buildSyncedTtml,
} from "@/test/ttml-fixtures";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { stripSplitCharacter } from "@/utils/split-character";
import { generateProjectTtml } from "@/utils/ttml";

// -- Constants ----------------------------------------------------------------

const EXPORT_DURATION_SECONDS = 30;
const REAL_PROJECT_FILES = process.env.INSYNC_REAL_PROJECTS?.split("\n").filter(Boolean) ?? [];

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
  const parsed = parseTtml(ttml);
  return { name: "ttml fixture", lines: parsed.lines, groups: parsed.groups ?? [], agents, metadata };
}

function fixtureProjects(): EditedTtmlProject[] {
  return [...EDITED_TTML_PROJECTS.map((build) => build()), ...TTML_FIXTURES.map((build) => projectFromTtml(build()))];
}

interface SavedRecord {
  name: string;
  lines: SavedLine[];
}

function realRecords(): SavedRecord[] {
  return REAL_PROJECT_FILES.flatMap((path) => {
    const contents = parseProjectFileContents(readFileSync(path, "utf8"));
    const files = contents.kind === "bundle" ? contents.projects : [contents.project];
    return files.map(({ metadata, lines }) => ({ name: `${path}: ${metadata.title}`, lines }));
  });
}

// The load before split marks were restored, so real exports are compared with what 3.x exported.
function linesLoadedAsSaved(lines: readonly SavedLine[]): LyricLine[] {
  const storeWords = (words: SavedLine["words"]) => words && wordsFromSpaced(words.map(({ id: _id, ...word }) => word));
  return lines.map(({ words, backgroundWords, ...fields }) =>
    reconcileLine({
      ...fields,
      words: storeWords(words),
      ...(backgroundWords && { backgroundWords: storeWords(backgroundWords) }),
    }),
  );
}

function realProjects(): EditedTtmlProject[] {
  return REAL_PROJECT_FILES.flatMap((path) => {
    const contents = parseProjectFileContents(readFileSync(path, "utf8"));
    const files = contents.kind === "bundle" ? contents.projects : [contents.project];
    return files.map(({ metadata, lines, groups, agents }) => ({
      name: `${path}: ${metadata.title}`,
      lines: linesLoadedAsSaved(lines),
      groups: groups ?? [],
      agents,
      metadata,
    }));
  });
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
  return words.map((word, index) => ({ ...word, ...roundTripped[index] }));
}

function throughSyllables(line: LyricLine): LyricLine {
  const words = line.words ? wordsThroughSyllables(line.words) : undefined;
  const backgroundWords = line.backgroundWords ? wordsThroughSyllables(line.backgroundWords) : undefined;
  return reconcileLine({ ...line, ...(words && { words }), ...(backgroundWords && { backgroundWords }) });
}

// A load may only put back syllable marks: everything else, the language fingerprint and the export stay.
function expectSaveAndLoadKeepEverything(project: EditedTtmlProject, record: SavedRecord): number {
  const storeLines = linesFromSaved(record.lines);
  const resaved = savedLines(storeLines);
  expect(savedLines(linesFromSaved(resaved)), record.name).toEqual(resaved);
  let repaired = 0;
  resaved.forEach((line, index) => {
    const saved = record.lines[index];
    expect({ ...line, text: saved.text, backgroundText: saved.backgroundText }, record.name).toEqual(saved);
    expect(stripSplitCharacter(line.text), record.name).toBe(stripSplitCharacter(saved.text));
    expect(stripSplitCharacter(line.backgroundText ?? ""), record.name).toBe(
      stripSplitCharacter(saved.backgroundText ?? ""),
    );
    expect(languageSourceFingerprint(line.text, line.backgroundText), record.name).toBe(
      languageSourceFingerprint(saved.text, saved.backgroundText),
    );
    if (line.text !== saved.text || line.backgroundText !== saved.backgroundText) repaired++;
  });
  expect(exportOf({ ...project, lines: storeLines }), record.name).toBe(exportOf(project));
  return repaired;
}

function exportOf(project: EditedTtmlProject): string {
  return generateProjectTtml(project, EXPORT_DURATION_SECONDS);
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
      expectSaveAndLoadKeepEverything(project, { name: project.name, lines: savedLines(project.lines) });
    }
  });

  it.runIf(REAL_PROJECT_FILES.length > 0)("a v3 save and load keeps real projects", () => {
    const records = realRecords();
    const projects = realProjects();
    expect(records.length).toBeGreaterThan(0);
    const repaired = records.reduce(
      (count, record, index) => count + expectSaveAndLoadKeepEverything(projects[index], record),
      0,
    );
    console.info(`[insync] lines with restored syllable marks: ${repaired}`);
  });

  it.runIf(REAL_PROJECT_FILES.length > 0)("syllable round trip keeps the export of real projects", () => {
    const projects = realProjects();
    expect(projects.length).toBeGreaterThan(0);
    expectRoundTripKeepsExport(projects);
  });
});
