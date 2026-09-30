import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { generateProjectTtml } from "@/utils/ttml";
import { applyEditedTtml } from "@/views/export/apply-edited-ttml";
import { beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function ttml(body: string, head = ""): string {
  return `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata>${head}</metadata></head><body><div>${body}</div></body></tt>`;
}

const TWO_LINES = ttml(
  '<p begin="00:01.000" end="00:02.000">Brand new</p><p begin="00:02.000" end="00:03.000">Second line</p>',
);

function lineTexts(): string[] {
  return useProjectStore.getState().lines.map((line) => line.text);
}

// -- Tests --------------------------------------------------------------------

describe("applyEditedTtml", () => {
  beforeEach(() => {
    useProjectStore.setState({
      lines: [createLine({ text: "Old line", begin: 0, end: 1 })],
      agents: DEFAULT_AGENTS,
      metadata: { title: "Kept title", artists: [], album: "", duration: 0 },
    });
  });

  it("replaces the lines with what the edited TTML encodes", () => {
    expect(applyEditedTtml(TWO_LINES, 0)).toMatchObject({ status: "applied", skipped: 0 });
    expect(lineTexts()).toEqual(["Brand new", "Second line"]);
    const [first] = useProjectStore.getState().lines;
    expect(first?.begin).toBe(1);
    expect(first?.end).toBe(2);
  });

  it("keeps word timing from the TTML", () => {
    applyEditedTtml(
      ttml(
        '<p begin="00:01.000" end="00:02.000"><span begin="00:01.000" end="00:01.500">Hel</span><span begin="00:01.500" end="00:02.000">lo</span></p>',
      ),
      0,
    );
    const [line] = useProjectStore.getState().lines;
    expect(line?.words?.map((word) => word.text)).toEqual(["Hel", "lo"]);
  });

  it("round-trips Composer's own export unchanged", () => {
    applyEditedTtml(TWO_LINES, 0);
    const before = useProjectStore.getState().lines;
    const result = applyEditedTtml(generateProjectTtml(useProjectStore.getState(), 0), 0);
    expect(result).toEqual({ status: "applied", skipped: 0, keptInExport: false });
    expect(useProjectStore.getState().lines).toEqual(before);
    expect(useProjectStore.getState().ttmlEditState).toBeNull();
  });

  it("is one undo step", () => {
    applyEditedTtml(TWO_LINES, 0);
    useProjectStore.getState().undo();
    expect(lineTexts()).toEqual(["Old line"]);
  });

  describe("partly synced projects", () => {
    beforeEach(() => {
      useProjectStore.setState({
        lines: [
          createLine({ text: "Timed line", begin: 0, end: 1 }),
          createLine({ text: "Not yet synced" }),
          createLine({
            text: "Half synced words here",
            words: [
              { text: "Half ", begin: 1, end: 2 },
              { text: "synced ", begin: 2, end: 3 },
            ],
          }),
        ],
        ttmlEditState: { source: "<tt/>", content: TWO_LINES },
      });
    });

    it("regression: also says why the edit cannot be read", () => {
      const result = applyEditedTtml("not xml at all", 0);
      expect(result).toMatchObject({ status: "export-only", reason: "not-synced" });
      if (result.status === "export-only" && result.reason === "not-synced")
        expect(result.message).toMatch(/edited TTML/);
    });

    it("regression: never touches the project and keeps the edit for the export", () => {
      const before = useProjectStore.getState().lines;
      expect(applyEditedTtml(TWO_LINES, 0)).toEqual({ status: "export-only", reason: "not-synced" });
      expect(useProjectStore.getState().lines).toBe(before);
      expect(useProjectStore.getState().ttmlEditState).toEqual({ source: "<tt/>", content: TWO_LINES });
      expect(useProjectStore.getState().canUndo()).toBe(false);
    });
  });

  describe("projects the export cannot hold", () => {
    it("regression: a project with a field the export does not carry stays as it was", () => {
      useProjectStore.setState({
        lines: [
          { ...createLine({ text: "Hello", begin: 1, end: 2 }), detached: true },
          createLine({ text: "World", begin: 2, end: 3 }),
        ],
      });
      const before = useProjectStore.getState().lines;
      const edited = generateProjectTtml(useProjectStore.getState(), 0).replace(">World<", ">World2<");
      expect(applyEditedTtml(edited, 0)).toEqual({ status: "export-only", reason: "not-held" });
      expect(useProjectStore.getState().lines).toBe(before);
      expect(useProjectStore.getState().canUndo()).toBe(false);
    });
  });

  describe("projects the export holds", () => {
    it("applies an edit to a project with full song details, named singers, groups and translations", () => {
      useProjectStore.setState({
        lines: [
          {
            ...createLine({ text: "Hello", begin: 1, end: 2, agentId: "v1" }),
            groupId: "g1",
            instanceIdx: 0,
            templateLineIdx: 0,
            translations: { es: { language: "es", text: "Hola", origin: "manual", sourceFingerprint: "fp" } },
          },
          createLine({ text: "World", begin: 2, end: 3, agentId: "v2" }),
        ],
        groups: [{ id: "g1", label: "Chorus", color: "#ff0000", templateVersion: 1 }],
        agents: [
          { id: "v1", type: "person", name: "Ana" },
          { id: "v2", type: "group", name: "Ben" },
        ],
        metadata: {
          title: "Song",
          artists: ["Ana", "Ben"],
          album: "Album",
          duration: 0,
          isrc: "USRC17607839",
          songwriters: ["Cara"],
          language: "en-us",
          extra: { mood: "calm" },
        },
      });
      const edited = generateProjectTtml(useProjectStore.getState(), 180).replace(">World<", ">World2<");
      expect(applyEditedTtml(edited, 180)).toMatchObject({ status: "applied" });
      expect(lineTexts()).toEqual(["Hello", "World2"]);
      expect(useProjectStore.getState().metadata.language).toBe("en-us");
    });

    it("regression: applies an edit to a project with a blank artist row", () => {
      useProjectStore.setState({
        lines: [createLine({ text: "Hello", begin: 1, end: 2 })],
        metadata: { title: "Song", artists: ["Ana", ""], album: "", duration: 0 },
      });
      const edited = generateProjectTtml(useProjectStore.getState(), 0).replace(">Hello<", ">Hello there<");
      expect(applyEditedTtml(edited, 0)).toMatchObject({ status: "applied" });
      expect(lineTexts()).toEqual(["Hello there"]);
      expect(useProjectStore.getState().metadata.artists).toEqual(["Ana", ""]);
    });

    it("regression: applies an edit to a project where a translation was removed", () => {
      useProjectStore.setState({
        lines: [
          { ...createLine({ text: "Hello", begin: 1, end: 2 }), translations: {} },
          createLine({ text: "World", begin: 2, end: 3 }),
        ],
      });
      const edited = generateProjectTtml(useProjectStore.getState(), 0).replace(">World<", ">World2<");
      expect(applyEditedTtml(edited, 0)).toMatchObject({ status: "applied" });
      expect(lineTexts()).toEqual(["Hello", "World2"]);
    });
  });

  describe("edits that change nothing in the project", () => {
    it("regression: adds no undo step and keeps the edit in the export", () => {
      useProjectStore.setState({ lines: [createLine({ text: "Hello", begin: 1, end: 2 })] });
      const generated = generateProjectTtml(useProjectStore.getState(), 0);
      const edited = generated.replace("<div>", "<div><!-- note -->");
      const editState = { source: generated, content: edited };
      useProjectStore.setState({ ttmlEditState: editState, isDirty: false });
      const before = useProjectStore.getState().lines;
      expect(applyEditedTtml(edited, 0)).toEqual({ status: "applied", skipped: 0, keptInExport: true });
      expect(useProjectStore.getState().lines).toBe(before);
      expect(useProjectStore.getState().canUndo()).toBe(false);
      expect(useProjectStore.getState().ttmlEditState).toBe(editState);
      expect(useProjectStore.getState().isDirty).toBe(false);
    });
  });

  describe("edits the project cannot hold", () => {
    it("regression: keeps a deleted title in the export while the project keeps its title", () => {
      useProjectStore.setState({
        lines: [createLine({ text: "Hello", begin: 1, end: 2 })],
        metadata: { title: "Kept title", artists: [], album: "", duration: 0 },
      });
      const generated = generateProjectTtml(useProjectStore.getState(), 0);
      const edited = generated.replace(/<ttm:title>[^<]*<\/ttm:title>/, "").replace(">Hello<", ">Hello there<");
      expect(applyEditedTtml(edited, 0)).toEqual({ status: "applied", skipped: 0, keptInExport: true });
      expect(lineTexts()).toEqual(["Hello there"]);
      expect(useProjectStore.getState().metadata.title).toBe("Kept title");
      const regenerated = generateProjectTtml(useProjectStore.getState(), 0);
      expect(useProjectStore.getState().ttmlEditState).toEqual({ source: regenerated, content: edited });
    });
  });

  describe("background vocals", () => {
    it("regression: a second Done still applies after editing a background text that has no word timing", () => {
      useProjectStore.setState({
        lines: [
          createLine({ text: "Hello", begin: 1, end: 2, backgroundText: "ooh yeah", backgroundTextSource: "manual" }),
        ],
      });
      const first = generateProjectTtml(useProjectStore.getState(), 0).replace(">ooh yeah<", ">ooh no<");
      expect(applyEditedTtml(first, 0)).toMatchObject({ status: "applied" });
      expect(useProjectStore.getState().lines[0]?.backgroundWords).toBeUndefined();
      const second = generateProjectTtml(useProjectStore.getState(), 0).replace(">Hello<", ">Hello there<");
      expect(applyEditedTtml(second, 0)).toMatchObject({ status: "applied" });
      expect(lineTexts()).toEqual(["Hello there"]);
    });

    it("regression: a second Done still applies after adding a line with a background text", () => {
      useProjectStore.setState({ lines: [createLine({ text: "Hello", begin: 1, end: 2 })] });
      const first = generateProjectTtml(useProjectStore.getState(), 0).replace(
        "</div>",
        '<p begin="0:04.000" end="0:05.000" ttm:agent="v1">Added<span ttm:role="x-bg"><span begin="0:04.000" end="0:05.000">ooh</span></span></p></div>',
      );
      expect(applyEditedTtml(first, 0)).toMatchObject({ status: "applied" });
      expect(useProjectStore.getState().lines[1]?.backgroundWords).toBeUndefined();
      const second = generateProjectTtml(useProjectStore.getState(), 0).replace(">Hello<", ">Hello there<");
      expect(applyEditedTtml(second, 0)).toMatchObject({ status: "applied" });
      expect(lineTexts()).toEqual(["Hello there", "Added"]);
    });
  });

  describe("song details", () => {
    it("regression: leaves the imported song detail flags as they were", () => {
      useProjectStore.setState({ importedMetadataKeys: [], hasUnexportedImport: false });
      applyEditedTtml(generateProjectTtml(useProjectStore.getState(), 0).replace(">Old line<", ">New line<"), 0);
      expect(lineTexts()).toEqual(["New line"]);
      expect(useProjectStore.getState().importedMetadataKeys).toEqual([]);
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    });
  });

  describe("error paths", () => {
    it("leaves the project alone when the text is not TTML", () => {
      const result = applyEditedTtml("CUSTOM EDITED CONTENT", 0);
      expect(result.status).toBe("unreadable");
      expect(lineTexts()).toEqual(["Old line"]);
    });

    it("leaves the project alone when the TTML has no lines", () => {
      expect(applyEditedTtml(ttml(""), 0).status).toBe("unreadable");
      expect(lineTexts()).toEqual(["Old line"]);
    });

    it("says why it could not read the TTML", () => {
      const result = applyEditedTtml("not xml at all", 0);
      expect(result).toMatchObject({ status: "unreadable" });
      if (result.status === "unreadable") expect(result.message).toMatch(/edited TTML/);
    });
  });

  describe("edge cases", () => {
    it("never runs background extraction on the edited TTML", () => {
      applyEditedTtml(ttml('<p begin="00:01.000" end="00:02.000">Hello (ooh)</p>'), 0);
      expect(lineTexts()).toEqual(["Hello (ooh)"]);
    });
  });
});
