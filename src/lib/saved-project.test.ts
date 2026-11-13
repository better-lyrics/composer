import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { pieceOf, trackPieces } from "@/domain/language/pieces";
import {
  linesFromSaved,
  SAVED_PROJECT_VERSION,
  type SavedLine,
  type SavedProject,
  savedLines,
  upgradeSavedProject,
} from "@/lib/saved-project";
import { describe, expect, it } from "vitest";

function legacyProject(version: SavedProject["version"]): SavedProject {
  return {
    version,
    savedAt: 1,
    metadata: { title: "Legacy", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    granularity: "word",
    lines: [
      {
        id: "L1",
        text: "걸음은 Like a dance",
        agentId: "v1",
        transliteration: {
          language: "ko-Latn",
          text: "geol-eum-eun Like a dance",
          segments: [],
          origin: "google",
          sourceFingerprint: "legacy",
        },
      },
    ],
  };
}

describe("upgradeSavedProject", () => {
  it("upgrades a version 1 record: transliterations migrate and the version becomes current", () => {
    const project = legacyProject(1);
    expect(upgradeSavedProject(project)).toBe(true);
    expect(project.version).toBe(SAVED_PROJECT_VERSION);
    expect(project.lines[0].transliteration?.text).toBe("geol eum eun  Like  a  dance");
    expect(project.lines[0].transliteration?.alignmentStatus).toBe("inferred");
  });

  it("upgrades a version 2 record", () => {
    const project = legacyProject(2);
    expect(upgradeSavedProject(project)).toBe(true);
    expect(project.version).toBe(SAVED_PROJECT_VERSION);
  });

  describe("invariants", () => {
    it("leaves a current record untouched and reports no change", () => {
      const project = legacyProject(3);
      const lines = project.lines;
      expect(upgradeSavedProject(project)).toBe(false);
      expect(project.lines).toBe(lines);
    });

    it("is idempotent", () => {
      const project = legacyProject(1);
      upgradeSavedProject(project);
      const once = structuredClone(project);
      expect(upgradeSavedProject(project)).toBe(false);
      expect(project).toEqual(once);
    });
  });

  describe("edge cases", () => {
    it("tolerates a malformed record whose lines are not an array", () => {
      const project = { ...legacyProject(1), lines: undefined } as unknown as SavedProject;
      expect(upgradeSavedProject(project)).toBe(true);
      expect(project.version).toBe(SAVED_PROJECT_VERSION);
    });
  });
});

describe("linesFromSaved", () => {
  it("gives loaded words new ids even when the file carries some", () => {
    const [line] = linesFromSaved([
      {
        id: "line-1",
        text: "Paper lanterns",
        agentId: "v1",
        words: [
          { id: "x", text: "Paper ", begin: 1, end: 2 },
          { id: "x", text: "lanterns", begin: 2, end: 3 },
        ],
      },
    ]);
    const ids = line.words?.map((word) => word.id) ?? [];
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain("x");
  });

  it("regression: puts back syllable marks the saved text lost and keeps them on the next load", () => {
    const [line] = linesFromSaved([
      {
        id: "line-1",
        text: "Paper lanterns",
        agentId: "v1",
        words: [
          { text: "Pa", begin: 1, end: 1.2 },
          { text: "per ", begin: 1.2, end: 1.6 },
          { text: "lanterns", begin: 1.6, end: 2.2 },
        ],
        backgroundText: "drifting",
        backgroundWords: [
          { text: "drif", begin: 2.2, end: 2.5 },
          { text: "ting", begin: 2.5, end: 2.9 },
        ],
      },
    ]);
    expect(line.text).toBe("Pa|per lanterns");
    expect(line.backgroundText).toBe("drif|ting");
    const [reloaded] = linesFromSaved(savedLines([line]));
    expect([reloaded.text, reloaded.backgroundText]).toEqual(["Pa|per lanterns", "drif|ting"]);
  });

  it("regression: a partly synced line's last timed syllable joins the untimed part after it", () => {
    const [line] = linesFromSaved([
      {
        id: "line-1",
        text: "hel|lo you",
        agentId: "v1",
        words: [{ text: "hel", begin: 1, end: 1.3 }],
        backgroundText: "o|oh yeah",
        backgroundWords: [{ text: "o", begin: 1, end: 1.2 }],
      },
    ]);
    expect(line.words?.map((word) => word.joinsNext)).toEqual([true]);
    expect(line.backgroundWords?.map((word) => word.joinsNext)).toEqual([true]);
  });

  it("keeps a line's languages and syllable readings where a version 3 record spells them", () => {
    const saved: SavedLine = {
      id: "line-1",
      text: "Paper lanterns",
      agentId: "v1",
      words: [
        { text: "Paper ", begin: 1, end: 1.6, transliteration: "pēpā", transliterationJoinerAfter: "  " },
        { text: "lanterns", begin: 1.6, end: 2.2, transliteration: "rantan" },
      ],
      backgroundText: "drifting",
      backgroundWords: [{ text: "drifting", begin: 2.2, end: 2.9, transliteration: "dorifuto" }],
      translations: {
        fr: { language: "fr", text: "Lanternes", backgroundText: "flottant", origin: "manual", sourceFingerprint: "a" },
      },
      transliteration: {
        language: "ja-Latn",
        text: "pēpā  rantan",
        backgroundText: "dorifuto",
        segments: [{ original: "Paper lanterns", transliteration: "pēpā  rantan" }],
        backgroundSegments: [{ original: "drifting", transliteration: "dorifuto" }],
        alignmentStatus: "confirmed",
        backgroundAlignmentStatus: "inferred",
        reviewedSourceFingerprint: "b",
        origin: "manual",
        sourceFingerprint: "a",
      },
    };
    const [line] = linesFromSaved([saved]);
    const firstWord = line.words?.[0];
    expect(firstWord && pieceOf(trackPieces(line, "main"), firstWord)).toEqual({ text: "pēpā", joinerAfter: "  " });
    expect(line.languages?.transliteration?.bg?.alignmentStatus).toBe("inferred");
    expect(savedLines([line])).toEqual([saved]);
  });
});
