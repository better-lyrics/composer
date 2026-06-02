import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { migrateSavedProjectRomanization } from "@/lib/migrate-romanization";

// -- Fixtures -----------------------------------------------------------------

interface V1Romanization {
  text: string;
  words?: Array<{ text: string; begin?: number; end?: number }>;
  wordTexts?: string[];
  source: "manual" | "generated";
}

type V1Line = Omit<LyricLine, "romanization"> & { romanization?: V1Romanization };

interface V1SavedProject {
  version: 1;
  savedAt: number;
  metadata: { title: string; artist: string; album: string; duration: number };
  agents: Array<{ id: string; name: string; type: "person" | "group" | "other" }>;
  groups: never[];
  granularity: "word" | "line";
  lines: V1Line[];
  syllableSplitDefaults?: { applyToAll: boolean; caseInsensitive: boolean };
  dismissedSuggestions?: string[];
  dismissedExplicitSuggestions?: string[];
}

const BASE_METADATA = { title: "Night Dancer", artist: "imase", album: "", duration: 0 };

function makeV1WordSyncedProject(): V1SavedProject {
  return {
    version: 1,
    savedAt: 1700000000000,
    metadata: { ...BASE_METADATA },
    agents: [{ id: "v1", name: "Voice 1", type: "person" }],
    groups: [],
    granularity: "word",
    lines: [
      {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
        romanization: {
          text: "yoru dakedo",
          words: [
            { text: "yoru", begin: 0, end: 1 },
            { text: "dakedo", begin: 1, end: 2 },
          ],
          source: "generated",
        },
      },
    ],
  };
}

function makeV1LineSyncedWithWordsProject(): V1SavedProject {
  return {
    version: 1,
    savedAt: 1700000000000,
    metadata: { ...BASE_METADATA },
    agents: [{ id: "v1", name: "Voice 1", type: "person" }],
    groups: [],
    granularity: "line",
    lines: [
      {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        begin: 0,
        end: 4,
        romanization: {
          text: "yoru dakedo",
          words: [
            { text: "yoru", begin: 0, end: 2 },
            { text: "dakedo", begin: 2, end: 4 },
          ],
          source: "generated",
        },
      },
    ],
  };
}

function makeV2WordSyncedProject(): V1SavedProject {
  return {
    version: 1,
    savedAt: 1700000000000,
    metadata: { ...BASE_METADATA },
    agents: [{ id: "v1", name: "Voice 1", type: "person" }],
    groups: [],
    granularity: "word",
    lines: [
      {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
        romanization: {
          text: "yoru dakedo",
          wordTexts: ["yoru", "dakedo"],
          source: "generated",
        },
      },
    ],
  };
}

// -- Tests --------------------------------------------------------------------

describe("migrateSavedProjectRomanization", () => {
  describe("translation", () => {
    it("translates v1 romanization.words[].text into v2 wordTexts[]", () => {
      const v1 = makeV1WordSyncedProject();
      const out = migrateSavedProjectRomanization(v1);
      const line = out.lines[0];
      expect(line.romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
      expect((line.romanization as { words?: unknown }).words).toBeUndefined();
    });

    it("preserves text and source on the migrated romanization", () => {
      const v1 = makeV1WordSyncedProject();
      const out = migrateSavedProjectRomanization(v1);
      const r = out.lines[0].romanization;
      expect(r?.text).toBe("yoru dakedo");
      expect(r?.source).toBe("generated");
    });

    it("translates v1 manual-source romanization the same way as generated", () => {
      const v1 = makeV1WordSyncedProject();
      v1.lines[0].romanization!.source = "manual";
      const out = migrateSavedProjectRomanization(v1);
      expect(out.lines[0].romanization?.source).toBe("manual");
      expect(out.lines[0].romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
    });

    it("translates each romanized line independently in a multi-line project", () => {
      const v1 = makeV1WordSyncedProject();
      v1.lines.push({
        id: "L2",
        text: "踊ろうか",
        agentId: "v1",
        words: [
          { text: "踊ろ", begin: 2, end: 3 },
          { text: "うか", begin: 3, end: 4 },
        ],
        romanization: {
          text: "odorou ka",
          words: [
            { text: "odorou", begin: 2, end: 3 },
            { text: "ka", begin: 3, end: 4 },
          ],
          source: "generated",
        },
      });
      const out = migrateSavedProjectRomanization(v1);
      expect(out.lines[0].romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
      expect(out.lines[1].romanization?.wordTexts).toEqual(["odorou", "ka"]);
    });
  });

  describe("identity / immutability", () => {
    it("leaves a v2-shape project untouched and returns the same reference", () => {
      const v2 = makeV2WordSyncedProject();
      const out = migrateSavedProjectRomanization(v2);
      expect(out).toBe(v2);
      expect(out.lines[0]).toBe(v2.lines[0]);
    });

    it("returns a new lines array reference only when at least one line changed", () => {
      const v1 = makeV1WordSyncedProject();
      const beforeLines = v1.lines;
      const out = migrateSavedProjectRomanization(v1);
      expect(out.lines).not.toBe(beforeLines);
    });

    it("does not mutate the input project on the v1 path", () => {
      const v1 = makeV1WordSyncedProject();
      const before = JSON.parse(JSON.stringify(v1));
      migrateSavedProjectRomanization(v1);
      expect(v1).toEqual(before);
    });

    it("keeps line references stable for lines that did not change", () => {
      const v1 = makeV1WordSyncedProject();
      v1.lines.push({ id: "L2", text: "hello", agentId: "v1" });
      const untouchedBefore = v1.lines[1];
      const out = migrateSavedProjectRomanization(v1);
      expect(out.lines[1]).toBe(untouchedBefore);
    });
  });

  describe("reconciler interaction", () => {
    it("drops mismatched-count wordTexts after migration via reconcileLine", () => {
      const v1 = makeV1WordSyncedProject();
      v1.lines[0].romanization!.words = [
        { text: "yo", begin: 0, end: 0.5 },
        { text: "ru", begin: 0.5, end: 1 },
        { text: "dakedo", begin: 1, end: 2 },
      ];
      const out = migrateSavedProjectRomanization(v1);
      const r = out.lines[0].romanization;
      expect(r?.text).toBe("yoru dakedo");
      expect(r?.wordTexts).toBeUndefined();
      expect((r as { words?: unknown }).words).toBeUndefined();
    });

    it("drops wordTexts on line-synced lines because they have no words array", () => {
      const v1 = makeV1LineSyncedWithWordsProject();
      const out = migrateSavedProjectRomanization(v1);
      const line = out.lines[0];
      expect(line.romanization?.text).toBe("yoru dakedo");
      expect(line.romanization?.wordTexts).toBeUndefined();
      expect((line.romanization as { words?: unknown }).words).toBeUndefined();
      expect("begin" in line && line.begin).toBe(0);
      expect("end" in line && line.end).toBe(4);
    });
  });

  describe("edge cases", () => {
    it("leaves a line untouched when it has no romanization", () => {
      const project: V1SavedProject = {
        version: 1,
        savedAt: 0,
        metadata: { ...BASE_METADATA },
        agents: [{ id: "v1", name: "Voice 1", type: "person" }],
        groups: [],
        granularity: "word",
        lines: [{ id: "L1", text: "hello", agentId: "v1" }],
      };
      const out = migrateSavedProjectRomanization(project);
      expect(out).toBe(project);
      expect(out.lines[0].romanization).toBeUndefined();
    });

    it("handles a project with no lines (defensive)", () => {
      const empty: V1SavedProject = {
        version: 1,
        savedAt: 0,
        metadata: { ...BASE_METADATA },
        agents: [],
        groups: [],
        granularity: "word",
        lines: [],
      };
      const out = migrateSavedProjectRomanization(empty);
      expect(out).toBe(empty);
      expect(out.lines).toEqual([]);
    });

    it("treats undefined .lines as a no-op", () => {
      const project = {
        version: 1 as const,
        savedAt: 0,
        metadata: { ...BASE_METADATA },
        agents: [],
        groups: [],
        granularity: "word" as const,
      };
      const out = migrateSavedProjectRomanization(project as never);
      expect(out).toBe(project);
    });

    it("handles a mix of v1 lines, v2 lines, and lines without romanization", () => {
      const v1 = makeV1WordSyncedProject();
      v1.lines.push(
        {
          id: "L2",
          text: "踊ろうか",
          agentId: "v1",
          words: [{ text: "踊ろうか", begin: 2, end: 4 }],
          romanization: { text: "odorou ka", wordTexts: ["odorou ka"], source: "generated" },
        },
        { id: "L3", text: "hello", agentId: "v1" },
      );
      const out = migrateSavedProjectRomanization(v1);
      expect(out.lines[0].romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
      expect(out.lines[1].romanization?.wordTexts).toEqual(["odorou ka"]);
      expect(out.lines[2].romanization).toBeUndefined();
    });
  });

  describe("field preservation", () => {
    it("preserves all top-level non-romanization fields on the project", () => {
      const v1 = makeV1WordSyncedProject();
      v1.syllableSplitDefaults = { applyToAll: true, caseInsensitive: false };
      v1.dismissedSuggestions = ["s1"];
      v1.dismissedExplicitSuggestions = ["es1"];
      const out = migrateSavedProjectRomanization(v1);
      expect(out.version).toBe(1);
      expect(out.savedAt).toBe(1700000000000);
      expect(out.metadata).toEqual(BASE_METADATA);
      expect(out.agents).toEqual(v1.agents);
      expect(out.groups).toEqual([]);
      expect(out.granularity).toBe("word");
      expect(out.syllableSplitDefaults).toEqual({ applyToAll: true, caseInsensitive: false });
      expect(out.dismissedSuggestions).toEqual(["s1"]);
      expect(out.dismissedExplicitSuggestions).toEqual(["es1"]);
    });

    it("preserves savedAt and version verbatim", () => {
      const v1 = makeV1WordSyncedProject();
      v1.savedAt = 1234567890;
      const out = migrateSavedProjectRomanization(v1);
      expect(out.version).toBe(1);
      expect(out.savedAt).toBe(1234567890);
    });

    it("preserves line.backgroundText, line.backgroundWords, line.groupId, line.instanceIdx", () => {
      const v1 = makeV1WordSyncedProject();
      v1.lines[0].backgroundText = "ooh";
      v1.lines[0].backgroundWords = [{ text: "ooh", begin: 0, end: 1 }];
      v1.lines[0].backgroundTextSource = "manual";
      v1.lines[0].groupId = "g1";
      v1.lines[0].instanceIdx = 0;
      v1.lines[0].templateLineIdx = 0;
      const out = migrateSavedProjectRomanization(v1);
      const line = out.lines[0];
      expect(line.backgroundText).toBe("ooh");
      expect(line.backgroundWords).toEqual([{ text: "ooh", begin: 0, end: 1 }]);
      expect(line.backgroundTextSource).toBe("manual");
      expect(line.groupId).toBe("g1");
      expect(line.instanceIdx).toBe(0);
      expect(line.templateLineIdx).toBe(0);
    });

    it("preserves the source word timings (line.words) verbatim", () => {
      const v1 = makeV1WordSyncedProject();
      const beforeWords = JSON.parse(JSON.stringify(v1.lines[0].words));
      const out = migrateSavedProjectRomanization(v1);
      expect("words" in out.lines[0] && out.lines[0].words).toEqual(beforeWords);
    });
  });
});

// -- Integration call-site guard ----------------------------------------------

describe("migrateSavedProjectRomanization call sites", () => {
  it("is referenced from loadCurrentProject and importProjectFromFile in persistence.ts", () => {
    const persistencePath = join(__dirname, "persistence.ts");
    const src = readFileSync(persistencePath, "utf8");
    expect(src).toMatch(/migrateSavedProjectRomanization/);
    const loadMatch = src.match(/async function loadCurrentProject[\s\S]*?\n\}/);
    expect(loadMatch).not.toBeNull();
    expect(loadMatch?.[0]).toMatch(/migrateSavedProjectRomanization/);
    const importMatch = src.match(/async function importProjectFromFile[\s\S]*?\n\}/);
    expect(importMatch).not.toBeNull();
    expect(importMatch?.[0]).toMatch(/migrateSavedProjectRomanization/);
  });
});
