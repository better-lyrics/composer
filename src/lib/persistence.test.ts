import { describe, expect, it } from "vitest";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { bgVoice, mainWords } from "@/domain/line/voices";
import { importProjectFromFile } from "@/lib/persistence";
import { mainBounds } from "@/domain/line/bounds";
import type { WordTiming } from "@/domain/word/timing";

describe("persistence: syllableSplitDefaults", () => {
  it("round-trips syllableSplitDefaults through importProjectFromFile", async () => {
    const metadata = { title: "Song", artist: "", album: "", duration: 0 };
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
      syllableSplitDefaults: { applyToAll: true, caseInsensitive: true },
    };
    const file = new File([JSON.stringify(payload)], "song.ttml-project.json", { type: "application/json" });

    const parsed = await importProjectFromFile(file);

    expect(parsed.syllableSplitDefaults).toEqual({ applyToAll: true, caseInsensitive: true });
  });

  it("fills in defaults when older project file is missing syllableSplitDefaults", async () => {
    const metadata = { title: "Old Song", artist: "", album: "", duration: 0 };
    const legacyPayload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
    };
    const file = new File([JSON.stringify(legacyPayload)], "legacy.ttml-project.json", { type: "application/json" });

    const parsed = await importProjectFromFile(file);

    expect(parsed.syllableSplitDefaults).toEqual({ applyToAll: false, caseInsensitive: false });
  });
});

describe("persistence: primingStripped round-trip", () => {
  it("persists and reads back primingStripped through importProjectFromFile", async () => {
    const metadata = { title: "Song", artist: "", album: "", duration: 0 };
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
      syllableSplitDefaults: { applyToAll: false, caseInsensitive: false },
      primingStripped: true,
    };
    const file = new File([JSON.stringify(payload)], "song.ttml-project.json", { type: "application/json" });

    const parsed = await importProjectFromFile(file);

    expect(parsed.primingStripped).toBe(true);
  });

  it("leaves primingStripped undefined when importing a pre-strip project", async () => {
    const metadata = { title: "Old", artist: "", album: "", duration: 0 };
    const legacy = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
    };
    const file = new File([JSON.stringify(legacy)], "legacy.ttml-project.json", { type: "application/json" });

    const parsed = await importProjectFromFile(file);

    expect(parsed.primingStripped).toBeUndefined();
  });

  it("preserves primingStripped=false explicitly", async () => {
    const metadata = { title: "Mid", artist: "", album: "", duration: 0 };
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
      primingStripped: false,
    };
    const file = new File([JSON.stringify(payload)], "mid.ttml-project.json", { type: "application/json" });

    const parsed = await importProjectFromFile(file);

    expect(parsed.primingStripped).toBe(false);
  });
});

describe("persistence: customSnapPoints round-trip", () => {
  it("importProjectFromFile preserves customSnapPoints when present", async () => {
    const metadata = { title: "Song", artist: "", album: "", duration: 0 };
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
      customSnapPoints: [5, 12],
    };
    const file = new File([JSON.stringify(payload)], "song.ttml-project.json", { type: "application/json" });

    const parsed = await importProjectFromFile(file);

    expect(parsed.customSnapPoints).toEqual([5, 12]);
  });

  it("leaves customSnapPoints undefined when importing a legacy project without the field", async () => {
    const metadata = { title: "Old", artist: "", album: "", duration: 0 };
    const legacy = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
    };
    const file = new File([JSON.stringify(legacy)], "legacy.ttml-project.json", { type: "application/json" });

    const parsed = await importProjectFromFile(file);

    expect(parsed.customSnapPoints).toBeUndefined();
  });
});

// -- Legacy flat-to-nested migration at the load boundary ---------------------

const wordSyncedWords: WordTiming[] = [
  { text: "Hel", begin: 1.2, end: 1.6 },
  { text: "lo", begin: 1.6, end: 2.1 },
];

const bgWords: WordTiming[] = [
  { text: "ah ", begin: 6.0, end: 7.2 },
  { text: "oh", begin: 7.2, end: 8.5 },
];

// A pre-voice-model project blob: lines carry flat sibling timing fields.
function oldFlatProject() {
  return {
    version: 1 as const,
    savedAt: Date.now(),
    metadata: { title: "Legacy", artist: "", album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [
      { id: "l1", agentId: "v1", text: "Hello", words: wordSyncedWords },
      { id: "l2", agentId: "v1", text: "Line synced", begin: 3.0, end: 7.5 },
      { id: "l3", agentId: "v1", text: "Main", backgroundText: "ooh" },
      { id: "l4", agentId: "v1", text: "Main", begin: 3.0, end: 7.5, backgroundWords: bgWords },
    ],
    groups: [],
    granularity: "word" as const,
  };
}

// An already-nested (current-format) project blob.
function nestedProject() {
  return {
    version: 1 as const,
    savedAt: Date.now(),
    metadata: { title: "Nested", artist: "", album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [
      { id: "n1", agentId: "v1", main: { text: "Hello", words: wordSyncedWords } },
      {
        id: "n2",
        agentId: "v1",
        main: { text: "Main", begin: 3.0, end: 7.5 },
        background: { text: "ooh oh", words: bgWords, source: "extraction" as const },
      },
    ],
    groups: [],
    granularity: "word" as const,
  };
}

describe("persistence: legacy flat-to-nested migration on load", () => {
  describe("importProjectFromFile", () => {
    it("migrates flat lines from an imported old-format file into nested voices", async () => {
      const file = new File([JSON.stringify(oldFlatProject())], "legacy.ttml-project.json", {
        type: "application/json",
      });

      const project = await importProjectFromFile(file);

      const [wordLine, lineLine, bgTextLine, bgWordsLine] = project.lines;
      expect(mainWords(wordLine)).toEqual(wordSyncedWords);
      expect(mainBounds(lineLine)).toEqual({ begin: 3.0, end: 7.5 });
      expect(bgVoice(bgTextLine)).toEqual({ text: "ooh", source: undefined });
      const bg = bgVoice(bgWordsLine);
      if (bg === null || !("words" in bg)) throw new Error("expected a word-synced background");
      expect(bg.words).toEqual(bgWords);
    });

    it("imports an already-nested project file unchanged (idempotent)", async () => {
      const stored = nestedProject();
      const file = new File([JSON.stringify(stored)], "nested.ttml-project.json", { type: "application/json" });

      const project = await importProjectFromFile(file);

      expect(project.lines).toEqual(stored.lines);
    });
  });
});
