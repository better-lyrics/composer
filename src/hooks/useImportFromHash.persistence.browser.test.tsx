import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bgVoice, mainWords } from "@/domain/line/voices";
import { mainBounds } from "@/domain/line/bounds";
import { useImportFromHash } from "@/hooks/useImportFromHash";
import { usePersistence } from "@/hooks/usePersistence";
import { getHashImportSettled, getPersistenceSettled } from "@/lib/persistence-settled";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { seedProject } from "@/test/idb";
import { render } from "@/test/render";
import type { WordTiming } from "@/domain/word/timing";

// -- Constants ----------------------------------------------------------------

const SAVED_TITLE = "Persisted Project";
const IMPORTED_TITLE = "Imported Project";

const SAVED_LINE = { id: "saved-line", text: "saved line", agentId: "v1" };
const IMPORTED_LINE = { id: "imported-line", text: "imported line", agentId: "v1" };

const SAVED_AGENT = { id: "v1", type: "person" as const, name: "Saved Lead" };
const IMPORTED_AGENT = { id: "v1", type: "person" as const, name: "Imported Lead" };

// -- Helpers ------------------------------------------------------------------

const HookHost: React.FC = () => {
  usePersistence();
  useImportFromHash();
  return null;
};

function setHash(hash: string): void {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
}

function setQuery(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

function encodeHashPayload(payload: unknown): string {
  return `#import=${encodeURIComponent(JSON.stringify(payload))}`;
}

function autoAcceptHashConfirm(): void {
  useSettingsStore.setState({ confirmReplaceProjectFromHash: false });
}

// Both writers signal completion via dedicated promises (persistenceSettled,
// hashImportSettled). Awaiting both pins the state to its final, stable value.
async function waitForBootSettled(): Promise<void> {
  await Promise.all([getPersistenceSettled(), getHashImportSettled()]);
}

function importedPayload() {
  return {
    metadata: { title: IMPORTED_TITLE, artist: "", album: "", duration: 0 },
    agents: [IMPORTED_AGENT],
    lines: [IMPORTED_LINE],
    granularity: "word" as const,
  };
}

function savedSnapshot(audioSource?: { kind: "youtube"; videoId: string } | { kind: "file"; name: string }) {
  return {
    version: 1,
    savedAt: Date.now(),
    metadata: { title: SAVED_TITLE, artist: "", album: "", duration: 0 },
    lines: [SAVED_LINE],
    agents: [SAVED_AGENT],
    granularity: "word" as const,
    ...(audioSource ? { audioSource } : {}),
  };
}

// -- Tests --------------------------------------------------------------------

describe("usePersistence + useImportFromHash — hash overrides persistence", () => {
  beforeEach(() => {
    setQuery("");
    setHash("");
  });

  afterEach(() => {
    setQuery("");
    setHash("");
  });

  it("hash import wins when persistence has a saved project", async () => {
    await seedProject(savedSnapshot());
    autoAcceptHashConfirm();
    setHash(encodeHashPayload(importedPayload()));

    await render(<HookHost />);
    await waitForBootSettled();

    const state = useProjectStore.getState();
    expect(state.metadata.title).toBe(IMPORTED_TITLE);
    expect(state.lines.map((l) => l.id)).toEqual([IMPORTED_LINE.id]);
    expect(state.agents[0]?.name).toBe(IMPORTED_AGENT.name);
  });

  it("hash import lines survive even when persistence has different saved lines", async () => {
    await seedProject(savedSnapshot());
    autoAcceptHashConfirm();
    setHash(encodeHashPayload(importedPayload()));

    await render(<HookHost />);
    await waitForBootSettled();

    expect(useProjectStore.getState().lines.map((l) => l.id)).toEqual([IMPORTED_LINE.id]);
  });

  it("hash import is no-op when payload is malformed; persistence's saved project survives", async () => {
    allowConsole(/Invalid import payload structure/);
    await seedProject(savedSnapshot());
    autoAcceptHashConfirm();
    setHash(`#import=${encodeURIComponent('{"not":"a payload"}')}`);

    await render(<HookHost />);
    await waitForBootSettled();

    const state = useProjectStore.getState();
    expect(state.metadata.title).toBe(SAVED_TITLE);
    expect(state.lines.map((l) => l.id)).toEqual([SAVED_LINE.id]);
  });

  it("no hash + saved project: persistence restore is observable", async () => {
    await seedProject(savedSnapshot());
    setHash("");

    await render(<HookHost />);
    await waitForBootSettled();

    const state = useProjectStore.getState();
    expect(state.metadata.title).toBe(SAVED_TITLE);
    expect(state.lines.map((l) => l.id)).toEqual([SAVED_LINE.id]);
  });

  it("hash import + empty IDB still applies", async () => {
    autoAcceptHashConfirm();
    setHash(encodeHashPayload(importedPayload()));

    await render(<HookHost />);
    await waitForBootSettled();

    expect(useProjectStore.getState().metadata.title).toBe(IMPORTED_TITLE);
  });

  it("hash import overrides persistence even when granularity differs", async () => {
    await seedProject({
      ...savedSnapshot(),
      granularity: "line" as const,
    });
    autoAcceptHashConfirm();
    setHash(encodeHashPayload({ ...importedPayload(), granularity: "word" as const }));

    await render(<HookHost />);
    await waitForBootSettled();

    expect(useProjectStore.getState().granularity).toBe("word");
  });
});

// -- Legacy flat-line migration on hash import --------------------------------

const FLAT_WORDS: WordTiming[] = [
  { text: "Hel", begin: 1.2, end: 1.6 },
  { text: "lo", begin: 1.6, end: 2.1 },
];

const FLAT_BG_WORDS: WordTiming[] = [
  { text: "ah ", begin: 6.0, end: 7.2 },
  { text: "oh", begin: 7.2, end: 8.5 },
];

function flatLinesPayload() {
  return {
    metadata: { title: IMPORTED_TITLE, artist: "", album: "", duration: 0 },
    agents: [IMPORTED_AGENT],
    lines: [
      { id: "fl1", agentId: "v1", text: "Hello", words: FLAT_WORDS },
      { id: "fl2", agentId: "v1", text: "Line synced", begin: 3.0, end: 7.5 },
      { id: "fl3", agentId: "v1", text: "Main", begin: 3.0, end: 7.5, backgroundWords: FLAT_BG_WORDS },
    ],
    granularity: "word" as const,
  };
}

describe("useImportFromHash · converter payloads may be flat", () => {
  beforeEach(() => {
    setQuery("");
    setHash("");
  });

  afterEach(() => {
    setQuery("");
    setHash("");
  });

  it("migrates old flat converter lines into nested voices with timing intact", async () => {
    autoAcceptHashConfirm();
    setHash(encodeHashPayload(flatLinesPayload()));

    await render(<HookHost />);
    await waitForBootSettled();

    const lines = useProjectStore.getState().lines;
    expect(lines.map((l) => l.id)).toEqual(["fl1", "fl2", "fl3"]);

    const [wordLine, lineLine, bgWordsLine] = lines;
    expect(mainWords(wordLine)).toEqual(FLAT_WORDS);
    expect(mainBounds(lineLine)).toEqual({ begin: 3.0, end: 7.5 });
    const bg = bgVoice(bgWordsLine);
    if (bg === null || !("words" in bg)) throw new Error("expected a word-synced background");
    expect(bg.words).toEqual(FLAT_BG_WORDS);
  });

  it("aborts the import and keeps the saved project when a line is malformed", async () => {
    allowConsole(/Failed to import from hash/);
    await seedProject(savedSnapshot());
    autoAcceptHashConfirm();
    setHash(
      encodeHashPayload({
        metadata: { title: IMPORTED_TITLE, artist: "", album: "", duration: 0 },
        agents: [IMPORTED_AGENT],
        lines: [{ id: "bad", agentId: "v1" }],
        granularity: "word" as const,
      }),
    );

    await render(<HookHost />);
    await waitForBootSettled();

    const state = useProjectStore.getState();
    expect(state.metadata.title).toBe(SAVED_TITLE);
    expect(state.lines.map((l) => l.id)).toEqual([SAVED_LINE.id]);
  });
});
