import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";

const SONG_A_TTML = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:title>Song A</ttm:title><ttm:agent type="person" xml:id="v1"><ttm:name type="full">Alice</ttm:name></ttm:agent><ttm:agent type="person" xml:id="v2"><ttm:name type="full">Bob</ttm:name></ttm:agent></metadata></head><body><div><p begin="0.0" end="1.0" ttm:agent="v1">Line one</p><p begin="1.0" end="2.0" ttm:agent="v2">Line two</p></div></body></tt>`;

function importParsed(parsed: ParseResult): void {
  useProjectStore.getState().replaceLyricsWithHistory({
    lines: parsed.lines,
    groups: parsed.groups ?? [],
    agents: parsed.agents,
    metadata: parsed.metadata,
  });
}

const texts = () => useProjectStore.getState().lines.map((l) => l.text);
const agentIds = () => useProjectStore.getState().agents.map((a) => a.id);

describe("D8 import vs history", () => {
  it("undo after import restores pre-import state and redo returns to the import", () => {
    const s = useProjectStore.getState();
    s.setLinesWithHistory([createLine({ id: "a", text: "Old one" })]);
    s.setLinesWithHistory([createLine({ id: "a", text: "Old one edited" })]);
    expect(useProjectStore.getState().historyIndex).toBe(2);

    importParsed(parseLyricsFile("new.txt", "New A\nNew B"));
    expect(texts()).toEqual(["New A", "New B"]);

    useProjectStore.getState().undo();
    const afterUndo = texts();
    useProjectStore.getState().redo();
    const afterRedo = texts();
    useProjectStore.getState().redo();
    expect(afterUndo).toEqual(["Old one edited"]);
    expect(afterRedo).toEqual(["New A", "New B"]);
  });

  it("undo with a single history entry after import", () => {
    useProjectStore.getState().setLinesWithHistory([createLine({ id: "a", text: "Old one" })]);
    importParsed(parseLyricsFile("new.txt", "New A"));
    useProjectStore.getState().undo();
    expect(texts()).toEqual(["Old one"]);
  });
});

describe("I2/I3 import leaves previous song state", () => {
  it("agents and metadata from a previous import persist into the next import", () => {
    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    importParsed(parseLyricsFile("b.txt", "Other song"));
    const st = useProjectStore.getState();
    expect(st.agents.map((a) => a.id)).toEqual(["v1"]);
    expect(st.metadata.title).not.toBe("Song A");
  });
});

describe("replaceLyricsWithHistory", () => {
  it("undoes lines, groups and agents in one step and redoes back to the import", () => {
    const group = createGroup({ id: "g-old" });
    useProjectStore.getState().setLines([createLine({ id: "old", text: "Old", agentId: "v1" })]);
    useProjectStore.getState().setGroups([group]);
    useProjectStore.getState().addAgent({ id: "v2", type: "person", name: "Bob" });
    const before = useProjectStore.getState();
    const snapshot = { lines: before.lines, groups: before.groups, agents: before.agents };

    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    const imported = useProjectStore.getState();
    const importedSnapshot = { lines: imported.lines, groups: imported.groups, agents: imported.agents };

    useProjectStore.getState().undo();
    const undone = useProjectStore.getState();
    expect({ lines: undone.lines, groups: undone.groups, agents: undone.agents }).toEqual(snapshot);

    useProjectStore.getState().redo();
    const redone = useProjectStore.getState();
    expect({ lines: redone.lines, groups: redone.groups, agents: redone.agents }).toEqual(importedSnapshot);
  });

  it("drops an agent from a previous import that no line references anymore", () => {
    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    expect(agentIds()).toEqual(["v1", "v2"]);
    importParsed(parseLyricsFile("b.txt", "Solo line"));
    expect(agentIds()).toEqual(["v1"]);
  });

  it("does not carry a TTML title into a plain text import", () => {
    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    expect(useProjectStore.getState().metadata.title).toBe("Song A");
    importParsed(parseLyricsFile("b.txt", "Solo line"));
    expect(useProjectStore.getState().metadata.title).toBe("");
  });

  it("keeps the song title of the loaded audio when nothing was imported before", () => {
    useProjectStore.getState().setMetadata({ title: "My Track" });
    importParsed(parseLyricsFile("b.txt", "Solo line"));
    expect(useProjectStore.getState().metadata.title).toBe("My Track");
  });

  it("clears album, artists and ISRC left by a previous import", () => {
    useProjectStore.getState().replaceLyricsWithHistory({
      lines: [createLine({ text: "One" })],
      groups: [],
      agents: undefined,
      metadata: { title: "A", album: "Album A", artists: ["Artist A"], isrc: "USRC17607839" },
    });
    importParsed(parseLyricsFile("b.txt", "Two"));
    const { metadata } = useProjectStore.getState();
    expect(metadata).toMatchObject({ title: "", album: "", artists: [], isrc: undefined });
  });

  it("keeps the thumbnail of the loaded video", () => {
    useProjectStore
      .getState()
      .setMetadata({ thumbnailDataUrl: "data:image/png;base64,AA", thumbnailForVideoId: "vid" });
    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    expect(useProjectStore.getState().metadata).toMatchObject({
      thumbnailDataUrl: "data:image/png;base64,AA",
      thumbnailForVideoId: "vid",
    });
  });

  it("marks song details as imported only when metadata or agents come in", () => {
    importParsed(parseLyricsFile("b.txt", "Solo line"));
    expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
  });

  it("does not add metadata to history snapshots", () => {
    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    for (const entry of useProjectStore.getState().history) expect(entry).not.toHaveProperty("metadata");
  });

  describe("invariants", () => {
    it("keeps an existing agent that the new lines still reference", () => {
      useProjectStore.getState().addAgent({ id: "v2", type: "person", name: "Bob" });
      useProjectStore.getState().replaceLyricsWithHistory({
        lines: [createLine({ text: "Duet", agentId: "v2" })],
        groups: [],
        agents: [{ id: "v3", type: "person", name: "Cara" }],
        metadata: {},
      });
      expect(agentIds()).toEqual(["v2", "v3"]);
      expect(useProjectStore.getState().agents[0].name).toBe("Bob");
    });

    it("updates the name and type of an existing agent the import also declares", () => {
      useProjectStore.getState().replaceLyricsWithHistory({
        lines: [createLine({ text: "Hi", agentId: "v1" })],
        groups: [],
        agents: [{ id: "v1", type: "group", name: "Everyone" }],
        metadata: {},
      });
      expect(useProjectStore.getState().agents).toEqual([{ id: "v1", type: "group", name: "Everyone" }]);
    });

    it("never leaves the project without an agent", () => {
      useProjectStore.getState().replaceLyricsWithHistory({
        lines: [createLine({ text: "Hi", agentId: "v9" })],
        groups: [],
        agents: undefined,
        metadata: {},
      });
      expect(useProjectStore.getState().agents.length).toBeGreaterThan(0);
    });

    it("leaves the metadata write out of pending history edits", () => {
      importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
      expect(useProjectStore.getState().isDirty).toBe(true);
    });
  });
});

describe("song details a lyrics import owns", () => {
  it("keeps artist, album and ISRC from the audio tags through a plain text import", () => {
    useProjectStore.getState().setMetadata({ artists: ["Tag Artist"], album: "Tag Album", isrc: "USQX91700001" });
    importParsed(parseLyricsFile("b.txt", "Solo line"));
    expect(useProjectStore.getState().metadata).toMatchObject({
      artists: ["Tag Artist"],
      album: "Tag Album",
      isrc: "USQX91700001",
    });
  });

  it("clears a TTML title on the next plain text import even after an export", () => {
    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    useProjectStore.getState().clearUnexportedImport();
    importParsed(parseLyricsFile("b.txt", "Solo line"));
    expect(useProjectStore.getState().metadata.title).toBe("");
  });

  it("keeps a title the user typed after a TTML import through the next import", () => {
    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    useProjectStore.getState().setMetadata({ title: "My Title" });
    importParsed(parseLyricsFile("b.txt", "Solo line"));
    expect(useProjectStore.getState().metadata.title).toBe("My Title");
  });

  it("replaces only the fields the previous import brought", () => {
    useProjectStore.getState().setMetadata({ artists: ["Tag Artist"] });
    importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
    expect(useProjectStore.getState().metadata).toMatchObject({ title: "Song A", artists: ["Tag Artist"] });
    importParsed(parseLyricsFile("b.txt", "Solo line"));
    expect(useProjectStore.getState().metadata).toMatchObject({ title: "", artists: ["Tag Artist"] });
  });

  describe("edge cases", () => {
    it("does not let an empty imported value replace a song detail", () => {
      useProjectStore.getState().setMetadata({ title: "Tag Title" });
      useProjectStore.getState().replaceLyricsWithHistory({
        lines: [createLine({ text: "One" })],
        groups: [],
        agents: undefined,
        metadata: { title: "", artists: [] },
      });
      expect(useProjectStore.getState().metadata).toMatchObject({ title: "Tag Title", artists: [] });
      expect(useProjectStore.getState().importedMetadataKeys).toEqual([]);
    });

    it("forgets what the last import brought when a different song loads", () => {
      importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
      useProjectStore.getState().resetSongIdentity("New Song");
      expect(useProjectStore.getState().importedMetadataKeys).toEqual([]);
      importParsed(parseLyricsFile("b.txt", "Solo line"));
      expect(useProjectStore.getState().metadata.title).toBe("New Song");
    });
  });

  describe("invariants", () => {
    it("records exactly the non-empty keys the import wrote", () => {
      useProjectStore.getState().replaceLyricsWithHistory({
        lines: [createLine({ text: "One" })],
        groups: [],
        agents: undefined,
        metadata: { title: "A", album: "", isrc: "USRC17607839" },
      });
      expect(useProjectStore.getState().importedMetadataKeys.toSorted()).toEqual(["isrc", "title"]);
    });

    it("hands a field to the song or the user once anything else writes it", () => {
      importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
      expect(useProjectStore.getState().importedMetadataKeys).toContain("title");
      useProjectStore.getState().setMetadata({ title: "Edited" });
      expect(useProjectStore.getState().importedMetadataKeys).not.toContain("title");
    });

    it("keeps the record out of history snapshots", () => {
      importParsed(parseLyricsFile("a.ttml", SONG_A_TTML));
      for (const entry of useProjectStore.getState().history) expect(entry).not.toHaveProperty("importedMetadataKeys");
    });
  });
});
