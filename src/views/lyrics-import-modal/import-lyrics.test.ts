import { describe, expect, it } from "vitest";
import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import type { ConfirmOptions } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import { generateTTML } from "@/utils/ttml";
import { type ImportContext, importLyrics } from "@/views/lyrics-import-modal/import-lyrics";

// -- Helpers ------------------------------------------------------------------

function lineFactory(id: string, text: string, agentId = "v1"): LyricLine {
  return { id, text, agentId };
}

const EMPTY_FILE = { filename: "empty.txt", content: "" };
const HELLO_WORLD = { filename: "test.txt", content: "Hello\nWorld" };

function ttmlFile(options: { head?: string; body?: string; lang?: string } = {}) {
  const lang = options.lang ? ` xml:lang="${options.lang}"` : "";
  const body =
    options.body ?? '<p begin="00:01.000" end="00:02.000">Hello</p><p begin="00:02.000" end="00:03.000">World</p>';
  return {
    filename: "song.ttml",
    content: `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"${lang}><head><metadata>${options.head ?? ""}</metadata></head><body><div>${body}</div></body></tt>`,
  };
}

function agentTag(agent: Agent): string {
  return `<ttm:agent type="${agent.type}" xml:id="${agent.id}"><ttm:name type="full">${agent.name}</ttm:name></ttm:agent>`;
}

function buildContext(overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    confirm: async () => true,
    audioDuration: 0,
    applyBackgroundExtraction: false,
    backgroundExtractionMergeStandalone: false,
    backgroundExtractionPreserveBrackets: false,
    sourceLabel: "Test",
    ...overrides,
  };
}

function searchResult(overrides: Partial<LyricsSearchResult> = {}): LyricsSearchResult {
  return {
    id: "42",
    source: "lrclib",
    sourceLabel: "LRCLib",
    syncType: "line",
    track: "Bohemian Rhapsody",
    artist: "Queen",
    album: "A Night at the Opera",
    payload: { kind: "lrc", synced: null, plain: null },
    ...overrides,
  };
}

const LRC_WITHOUT_TAGS = "[00:01.00]Is this the real life\n[00:03.00]Is this just fantasy";

// -- Empty input --------------------------------------------------------------

describe("importLyrics empty input", () => {
  it("returns false when the parsed result has no lines", async () => {
    const beforeLines = useProjectStore.getState().lines;
    const result = await importLyrics(EMPTY_FILE, buildContext());
    expect(result).toBe(false);
    expect(useProjectStore.getState().lines).toBe(beforeLines);
  });

  it("leaves metadata and history untouched", async () => {
    const before = useProjectStore.getState();
    await importLyrics({ filename: "broken.ttml", content: '<tt><body><p begin="00:01.000"' }, buildContext());
    const after = useProjectStore.getState();
    expect(after.metadata).toBe(before.metadata);
    expect(after.history).toBe(before.history);
  });
});

// -- Confirm replace ----------------------------------------------------------

describe("importLyrics confirm flow", () => {
  it("does not prompt when no existing lines are present", async () => {
    let promptCount = 0;
    const result = await importLyrics(
      HELLO_WORLD,
      buildContext({
        confirm: async () => {
          promptCount++;
          return true;
        },
      }),
    );
    expect(result).toBe(true);
    expect(promptCount).toBe(0);
    expect(useProjectStore.getState().lines.length).toBe(2);
  });

  it("prompts when existing lines are present and rejects the import on cancel", async () => {
    useProjectStore.getState().setLines([lineFactory("existing", "Old")]);
    let promptCount = 0;
    const result = await importLyrics(
      HELLO_WORLD,
      buildContext({
        confirm: async () => {
          promptCount++;
          return false;
        },
      }),
    );
    expect(result).toBe(false);
    expect(promptCount).toBe(1);
    expect(useProjectStore.getState().lines.length).toBe(1);
    expect(useProjectStore.getState().lines[0].text).toBe("Old");
  });

  it("replaces lines when the user confirms", async () => {
    useProjectStore.getState().setLines([lineFactory("existing", "Old")]);
    const result = await importLyrics(HELLO_WORLD, buildContext({ confirm: async () => true }));
    expect(result).toBe(true);
    expect(useProjectStore.getState().lines.length).toBe(2);
    expect(useProjectStore.getState().lines.map((l) => l.text)).toEqual(["Hello", "World"]);
  });

  it("says the replace can be undone instead of claiming it cannot", async () => {
    useProjectStore.getState().setLines([lineFactory("a", "Old"), lineFactory("b", "Older")]);
    const prompts: ConfirmOptions[] = [];
    await importLyrics(
      HELLO_WORLD,
      buildContext({
        confirm: async (options) => {
          prompts.push(options);
          return true;
        },
      }),
    );
    expect(prompts[0].title).toBe("Replace existing lyrics?");
    expect(prompts[0].description).not.toContain("cannot be undone");
    expect(prompts[0].description).toBe("This replaces your 2 existing lines.");
    expect(prompts[0].recoverable).toBe(true);
  });

  it("uses the singular for one existing line", async () => {
    useProjectStore.getState().setLines([lineFactory("a", "Old")]);
    const prompts: ConfirmOptions[] = [];
    await importLyrics(
      HELLO_WORLD,
      buildContext({
        confirm: async (options) => {
          prompts.push(options);
          return true;
        },
      }),
    );
    expect(prompts[0].description).toBe("This replaces your 1 existing line.");
  });

  it("undoes the whole import in one step", async () => {
    useProjectStore.getState().setLinesWithHistory([lineFactory("existing", "Old")]);
    await importLyrics(HELLO_WORLD, buildContext());
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines.map((l) => l.text)).toEqual(["Old"]);
  });
});

// -- Distribute timing --------------------------------------------------------

describe("importLyrics timing distribution", () => {
  it("does not distribute timing when audioDuration is zero and there is no timing data", async () => {
    await importLyrics(HELLO_WORLD, buildContext({ audioDuration: 0 }));
    const lines = useProjectStore.getState().lines;
    expect(lines[0].words).toBeUndefined();
    expect(lines[0].begin).toBeUndefined();
    expect(lines[0].end).toBeUndefined();
  });

  it("distributes timing across the audio when parsed lacks timing data", async () => {
    await importLyrics(HELLO_WORLD, buildContext({ audioDuration: 120 }));
    const lines = useProjectStore.getState().lines;
    expect(lines[0].words).toBeDefined();
    expect(lines[0].words?.length).toBeGreaterThan(0);
    const firstWord = lines[0].words?.[0];
    const lastLine = lines[lines.length - 1];
    const lastWord = lastLine.words?.[lastLine.words.length - 1];
    expect(firstWord?.begin).toBe(0);
    expect(lastWord?.end).toBeCloseTo(120, 3);
  });

  it("does not distribute when parsed already has timing data", async () => {
    await importLyrics(
      ttmlFile({ body: '<p begin="00:01.000" end="00:02.000"><span begin="00:01.000" end="00:02.000">Hi</span></p>' }),
      buildContext({ audioDuration: 60 }),
    );
    const stored = useProjectStore.getState().lines;
    expect(stored.length).toBe(1);
    expect(stored[0].words).toEqual([{ text: "Hi", begin: 1, end: 2 }]);
  });
});

// -- Background extraction ----------------------------------------------------

describe("importLyrics background extraction", () => {
  it("applies background extraction when the flag is set", async () => {
    await importLyrics(
      { filename: "x.txt", content: "Hello (world)" },
      buildContext({ applyBackgroundExtraction: true }),
    );
    const stored = useProjectStore.getState().lines;
    expect(stored.length).toBe(1);
    expect(stored[0].text).toBe("Hello");
    expect(stored[0].backgroundText).toBe("world");
  });

  it("passes original lines through when the flag is unset", async () => {
    await importLyrics(
      { filename: "x.txt", content: "Hello (world)" },
      buildContext({ applyBackgroundExtraction: false }),
    );
    const stored = useProjectStore.getState().lines;
    expect(stored.length).toBe(1);
    expect(stored[0].text).toBe("Hello (world)");
    expect(stored[0].backgroundText).toBeUndefined();
  });
});

// -- Agents -------------------------------------------------------------------

describe("importLyrics agents", () => {
  it("adds new imported agents", async () => {
    await importLyrics(
      ttmlFile({
        head: agentTag({ id: "v2", type: "person", name: "Voice 2" }),
        body: '<p begin="00:01.000" end="00:02.000" ttm:agent="v2">Hello</p>',
      }),
      buildContext(),
    );
    const stored = useProjectStore.getState().agents;
    expect(stored.find((a) => a.id === "v2")).toEqual({ id: "v2", type: "person", name: "Voice 2" });
  });

  it("updates name and type on existing agents", async () => {
    const existing: Agent = { id: "v1", type: "person", name: "Voice 1" };
    useProjectStore.getState().addAgent(existing);
    await importLyrics(
      ttmlFile({
        head: agentTag({ id: "v1", type: "character", name: "Renamed" }),
        body: '<p begin="00:01.000" end="00:02.000" ttm:agent="v1">Hello</p>',
      }),
      buildContext(),
    );
    const stored = useProjectStore.getState().agents.find((a) => a.id === "v1");
    expect(stored).toBeDefined();
    expect(stored?.name).toBe("Renamed");
    expect(stored?.type).toBe("character");
  });
});

describe("importLyrics default singer", () => {
  it("gives lyrics without singers the first singer of the project", async () => {
    useProjectStore.getState().setAgents([{ id: "v2", type: "person", name: "Bob" }]);
    await importLyrics(HELLO_WORLD, buildContext());
    const { lines, agents } = useProjectStore.getState();
    expect(lines.map((line) => line.agentId)).toEqual(["v2", "v2"]);
    expect(agents).toEqual([{ id: "v2", type: "person", name: "Bob" }]);
  });
});

// -- Metadata -----------------------------------------------------------------

describe("importLyrics metadata", () => {
  it("leaves every song detail unchanged when the lyrics carry none", async () => {
    useProjectStore.getState().setMetadata({ title: "Tag Title", artists: ["Tag Artist"], album: "Tag Album" });
    const before = useProjectStore.getState().metadata;
    await importLyrics(HELLO_WORLD, buildContext());
    expect(useProjectStore.getState().metadata).toEqual(before);
  });

  it("applies metadata when keys are present", async () => {
    await importLyrics({ filename: "a.lrc", content: `[ti:Bohemian Rhapsody]\n${LRC_WITHOUT_TAGS}` }, buildContext());
    expect(useProjectStore.getState().metadata.title).toBe("Bohemian Rhapsody");
  });

  it("marks the song details as imported when metadata comes with the lyrics", async () => {
    await importLyrics({ filename: "a.lrc", content: `[ti:Bohemian Rhapsody]\n${LRC_WITHOUT_TAGS}` }, buildContext());
    expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
  });

  it("marks the song details as imported when singer names come with the lyrics", async () => {
    await importLyrics(
      ttmlFile({
        head: agentTag({ id: "v1", type: "person", name: "Freddie" }),
        body: '<p begin="00:01.000" end="00:02.000" ttm:agent="v1">Hello</p>',
      }),
      buildContext(),
    );
    expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
  });

  it("fills title, artist and album from a search result whose lyrics carry none", async () => {
    await importLyrics(
      { filename: "lrclib-42.lrc", content: LRC_WITHOUT_TAGS, searchResult: searchResult() },
      buildContext(),
    );
    expect(useProjectStore.getState().metadata).toMatchObject({
      title: "Bohemian Rhapsody",
      artists: ["Queen"],
      album: "A Night at the Opera",
    });
  });

  it("replaces the details a search result filled on the next plain import", async () => {
    await importLyrics(
      { filename: "lrclib-42.lrc", content: LRC_WITHOUT_TAGS, searchResult: searchResult() },
      buildContext(),
    );
    await importLyrics(HELLO_WORLD, buildContext());
    expect(useProjectStore.getState().metadata).toMatchObject({ title: "", artists: [], album: "" });
  });

  it("prefers the title the lyrics carry over the search result track", async () => {
    await importLyrics(
      { filename: "lrclib-42.lrc", content: `[ti:From the file]\n${LRC_WITHOUT_TAGS}`, searchResult: searchResult() },
      buildContext(),
    );
    expect(useProjectStore.getState().metadata.title).toBe("From the file");
    expect(useProjectStore.getState().metadata.artists).toEqual(["Queen"]);
  });

  describe("edge cases", () => {
    it("does not let an empty tag in the lyrics hide the search result details", async () => {
      await importLyrics(
        { filename: "lrclib-42.lrc", content: `[ti: ]\n[ar:]\n${LRC_WITHOUT_TAGS}`, searchResult: searchResult() },
        buildContext(),
      );
      expect(useProjectStore.getState().metadata).toMatchObject({ title: "Bohemian Rhapsody", artists: ["Queen"] });
    });

    it("does not mark song details for plain lyrics with no metadata or singers", async () => {
      await importLyrics(HELLO_WORLD, buildContext());
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    });

    it("does not mark song details when the import is rejected", async () => {
      useProjectStore.getState().setLines([lineFactory("existing", "Old")]);
      await importLyrics(
        { filename: "a.lrc", content: `[ti:Bohemian Rhapsody]\n${LRC_WITHOUT_TAGS}` },
        buildContext({ confirm: async () => false }),
      );
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    });

    it("skips an empty album on the search result", async () => {
      await importLyrics(
        { filename: "lrclib-42.lrc", content: LRC_WITHOUT_TAGS, searchResult: searchResult({ album: undefined }) },
        buildContext(),
      );
      expect(useProjectStore.getState().metadata.album).toBe("");
    });
  });

  it("lands the language of an imported TTML in the store", async () => {
    await importLyrics(
      ttmlFile({
        lang: "pt-BR",
        head: '<ttm:agent type="person" xml:id="v1"/>',
        body: '<p begin="00:01.000" end="00:02.000" ttm:agent="v1"><span begin="00:01.000" end="00:01.500">Ola</span> <span begin="00:01.500" end="00:02.000">mundo</span></p>',
      }),
      buildContext(),
    );
    expect(useProjectStore.getState().metadata.language).toBe("pt-BR");
  });
});

// -- Groups -------------------------------------------------------------------

describe("importLyrics groups", () => {
  it("writes empty groups when not provided", async () => {
    useProjectStore.getState().setGroups([{ id: "g0", label: "Old", color: "#a3c9ff", templateVersion: 0 }]);
    await importLyrics(HELLO_WORLD, buildContext());
    expect(useProjectStore.getState().groups).toEqual([]);
  });

  it("writes the provided groups", async () => {
    const groups = [{ id: "g1", label: "Chorus", color: "#a3c9ff", templateVersion: 1 }];
    const content = generateTTML({
      metadata: { title: "", artists: [], album: "", duration: 0 },
      agents: [{ id: "v1", type: "person", name: "Lead" }],
      lines: [{ id: "a", text: "Hello", agentId: "v1", begin: 1, end: 2 }],
      groups,
    });
    await importLyrics({ filename: "grouped.ttml", content }, buildContext());
    expect(useProjectStore.getState().groups).toEqual(groups);
  });
});

// -- onResult callback --------------------------------------------------------

describe("importLyrics onResult", () => {
  it("calls onResult with the parsed result and source info after a successful import", async () => {
    const calls: { parsed: ParseResult; label: string; filename: string }[] = [];
    await importLyrics(
      { filename: "lrclib-123.lrc", content: "[00:01.00]Hello\n[00:02.00]World" },
      buildContext({
        sourceLabel: "LRCLib",
        onResult: (p, src) => calls.push({ parsed: p, label: src.label, filename: src.filename }),
      }),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].label).toBe("LRCLib");
    expect(calls[0].filename).toBe("lrclib-123.lrc");
    expect(calls[0].parsed.lines.map((line) => line.text)).toEqual(["Hello", "World"]);
  });

  it("labels a search import with the provider of the result", async () => {
    const labels: string[] = [];
    await importLyrics(
      { filename: "lrclib-42.lrc", content: LRC_WITHOUT_TAGS, searchResult: searchResult() },
      buildContext({ sourceLabel: "File", onResult: (_parsed, src) => labels.push(src.label) }),
    );
    expect(labels).toEqual(["LRCLib"]);
  });

  it("does not call onResult when import was rejected via confirm", async () => {
    useProjectStore.getState().setLines([lineFactory("existing", "Old")]);
    let calls = 0;
    await importLyrics(
      HELLO_WORLD,
      buildContext({
        confirm: async () => false,
        onResult: () => calls++,
      }),
    );
    expect(calls).toBe(0);
  });

  it("does not call onResult when parsed has no lines", async () => {
    let calls = 0;
    await importLyrics(EMPTY_FILE, buildContext({ onResult: () => calls++ }));
    expect(calls).toBe(0);
  });
});
