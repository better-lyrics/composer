import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bgVoice, mainWords } from "@/domain/line/voices";
import { clearCurrentProject, loadCurrentProject } from "@/lib/persistence";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { mainBounds } from "@/domain/line/bounds";
import { PROJECT_STORE_NAME, setInStore } from "@/lib/persistence-idb";
import type { WordTiming } from "@/domain/word/timing";

// The shared browser setup (src/test/setup-browser.ts) deletes the entire
// `ttml-composer` database before every test. We also clear the current
// project record explicitly to mirror the existing IDB test style. These tests
// run in the browser project because loadCurrentProject hits real IndexedDB.

// -- Fixtures -----------------------------------------------------------------

const wordSyncedWords: WordTiming[] = [
  { text: "Hel", begin: 1.2, end: 1.6 },
  { text: "lo", begin: 1.6, end: 2.1 },
];

const backgroundWords: WordTiming[] = [
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
      { id: "l4", agentId: "v1", text: "Main", begin: 3.0, end: 7.5, backgroundWords },
    ],
    groups: [],
    granularity: "word" as const,
  };
}

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
        background: { text: "ooh oh", words: backgroundWords, source: "extraction" as const },
      },
    ],
    groups: [],
    granularity: "word" as const,
  };
}

// -- Tests --------------------------------------------------------------------

describe("persistence · loadCurrentProject legacy migration", () => {
  beforeEach(async () => {
    await clearCurrentProject();
  });
  afterEach(async () => {
    await clearCurrentProject();
  });

  it("migrates flat lines from a stored old-format project into nested voices", async () => {
    await setInStore(PROJECT_STORE_NAME, "current", oldFlatProject());

    const project = await loadCurrentProject();
    if (!project) throw new Error("expected a stored project");

    const [wordLine, lineLine, bgTextLine, bgWordsLine] = project.lines;

    expect(mainWords(wordLine)).toEqual(wordSyncedWords);
    expect(mainBounds(lineLine)).toEqual({ begin: 3.0, end: 7.5 });
    expect(bgVoice(bgTextLine)).toEqual({ text: "ooh", source: undefined });

    const bg = bgVoice(bgWordsLine);
    if (bg === null || !("words" in bg)) throw new Error("expected a word-synced background");
    expect(bg.words).toEqual(backgroundWords);
  });

  it("returns undefined when no project is stored", async () => {
    const project = await loadCurrentProject();
    expect(project).toBeUndefined();
  });

  it("loads an already-nested project unchanged (idempotent)", async () => {
    const stored = nestedProject();
    await setInStore(PROJECT_STORE_NAME, "current", stored);

    const project = await loadCurrentProject();
    if (!project) throw new Error("expected a stored project");

    expect(project.lines).toEqual(stored.lines);
  });
});
