import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { generateProjectTtml } from "@/utils/ttml";
import { applyEditedTtml } from "@/views/export/apply-edited-ttml";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function lineTexts(): string[] {
  return useProjectStore.getState().lines.map((line) => line.text);
}

// -- Tests --------------------------------------------------------------------

describe("applyEditedTtml · whether the export holds the project", () => {
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
      expect(applyEditedTtml(edited, 0)).toEqual({ status: "export-only", reason: "not-held", part: "lines" });
      expect(useProjectStore.getState().lines).toBe(before);
      expect(useProjectStore.getState().canUndo()).toBe(false);
    });
  });

  describe("projects the export cannot hold: song details", () => {
    it("regression: names the song details when a custom field uses a reserved key", () => {
      useProjectStore.setState({
        lines: [createLine({ text: "Hello", begin: 1, end: 2 })],
        metadata: { title: "Song", artists: [], album: "Real album", duration: 0, extra: { album: "Other album" } },
      });
      const before = useProjectStore.getState().metadata;
      const edited = generateProjectTtml(useProjectStore.getState(), 0).replace(">Hello<", ">Hello there<");
      expect(applyEditedTtml(edited, 0)).toEqual({ status: "export-only", reason: "not-held", part: "metadata" });
      expect(useProjectStore.getState().metadata).toBe(before);
      expect(lineTexts()).toEqual(["Hello"]);
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

    it("regression: applies an edit to a project with a singer whose name was cleared", () => {
      useProjectStore.setState({
        lines: [
          createLine({ text: "Hello", begin: 1, end: 2, agentId: "v1" }),
          createLine({ text: "World", begin: 2, end: 3, agentId: "v2" }),
        ],
        agents: [
          { id: "v1", type: "person", name: "Ana" },
          { id: "v2", type: "person", name: undefined },
        ],
      });
      const edited = generateProjectTtml(useProjectStore.getState(), 0).replace(">World<", ">World2<");
      expect(applyEditedTtml(edited, 0)).toMatchObject({ status: "applied" });
      expect(lineTexts()).toEqual(["Hello", "World2"]);
      expect(useProjectStore.getState().agents[1]?.name).toBeUndefined();
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
});
