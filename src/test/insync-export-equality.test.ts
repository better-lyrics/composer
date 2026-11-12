import { syllablesFromWords } from "insync/from-words";
import { wordsFromSyllables } from "insync/to-words";
import { describe, expect, it } from "vitest";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { EDITED_TTML_PROJECTS, type EditedTtmlProject } from "@/test/edited-ttml-projects";
import {
  buildAlternateBackgroundLanguageTtml,
  buildAlternateLanguageTtml,
  buildBackgroundVocalTtml,
  buildMatchingAlternateLanguageTtml,
  buildSyncedTtml,
} from "@/test/ttml-fixtures";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { generateProjectTtml } from "@/utils/ttml";

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
  const parsed = parseTtml(ttml);
  return { name: "ttml fixture", lines: parsed.lines, groups: parsed.groups ?? [], agents, metadata };
}

function fixtureProjects(): EditedTtmlProject[] {
  return [...EDITED_TTML_PROJECTS.map((build) => build()), ...TTML_FIXTURES.map((build) => projectFromTtml(build()))];
}

function wordsThroughSyllables(words: readonly WordTiming[]): WordTiming[] {
  const roundTripped = wordsFromSyllables(syllablesFromWords(words));
  expect(roundTripped).toHaveLength(words.length);
  return words.map((word, index) => ({ ...word, ...roundTripped[index] }));
}

function throughSyllables(line: LyricLine): LyricLine {
  const words = line.words ? wordsThroughSyllables(line.words) : undefined;
  const backgroundWords = line.backgroundWords ? wordsThroughSyllables(line.backgroundWords) : undefined;
  return reconcileLine({ ...line, ...(words && { words }), ...(backgroundWords && { backgroundWords }) });
}

function exportOf(project: EditedTtmlProject): string {
  return generateProjectTtml(project, EXPORT_DURATION_SECONDS);
}

// -- Tests --------------------------------------------------------------------

describe("insync export equality", () => {
  it("syllable round trip keeps every exported byte", () => {
    const projects = fixtureProjects();
    expect(projects.every((project) => exportOf(project) !== "")).toBe(true);
    for (const project of projects) {
      const before = exportOf(project);
      const after = exportOf({ ...project, lines: project.lines.map(throughSyllables) });
      expect(after, project.name).toBe(before);
    }
  });
});
