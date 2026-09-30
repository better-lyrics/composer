import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { generateProjectTtml } from "@/utils/ttml";
import { applyEditedTtml } from "@/views/export/apply-edited-ttml";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("applyEditedTtml · edits and the lyrics they were written against", () => {
  describe("regressions: edits written against older lyrics", () => {
    it("regression: an edit whose source is not the current export stays in the export only", () => {
      useProjectStore.setState({ lines: [createLine({ text: "Hello", begin: 1, end: 2 })] });
      const edited = generateProjectTtml(useProjectStore.getState(), 0).replace(">Hello<", ">Hello there<");
      const editState = { source: "an older export", content: edited };
      useProjectStore.setState({ ttmlEditState: editState });
      const before = useProjectStore.getState().lines;
      expect(applyEditedTtml(edited, 0)).toEqual({ status: "export-only", reason: "lyrics-changed" });
      expect(useProjectStore.getState().lines).toBe(before);
      expect(useProjectStore.getState().ttmlEditState).toBe(editState);
    });

    it("regression: an edit kept over changed lyrics stays in the export only", () => {
      useProjectStore.setState({ lines: [createLine({ text: "Hello", begin: 1, end: 2 })] });
      const generated = generateProjectTtml(useProjectStore.getState(), 0);
      const edited = generated.replace(">Hello<", ">Hello there<");
      useProjectStore.setState({ ttmlEditState: { source: generated, content: edited, lyricsChanged: true } });
      const before = useProjectStore.getState().lines;
      expect(applyEditedTtml(edited, 0)).toEqual({ status: "export-only", reason: "lyrics-changed" });
      expect(useProjectStore.getState().lines).toBe(before);
    });

    it("regression: an edit kept in the export follows the new line keys after Done", () => {
      useProjectStore.setState({
        lines: [
          createLine({ id: "a", text: "Alpha", begin: 1, end: 2 }),
          createLine({ id: "b", text: "Bravo", begin: 2, end: 3 }),
          createLine({ id: "c", text: "Charlie", begin: 3, end: 4 }),
        ],
        metadata: { title: "Kept title", artists: [], album: "", duration: 0 },
      });
      const edited = generateProjectTtml(useProjectStore.getState(), 0)
        .replace(/\n\s*<p [^>]*>Bravo<\/p>/, "")
        .replace(/<ttm:title>[^<]*<\/ttm:title>/, "");
      expect(applyEditedTtml(edited, 0)).toMatchObject({ status: "applied", keptInExport: true });
      const kept = useProjectStore.getState().ttmlEditState;
      expect(kept?.content).toContain('itunes:key="L2" ttm:agent="v1">Charlie<');
      const again = kept?.content.replace(">Charlie<", ">Charlie!<") ?? "";
      useProjectStore.getState().setTtmlEditState({ source: kept?.source ?? "", content: again });
      expect(applyEditedTtml(again, 0)).toMatchObject({ status: "applied" });
      expect(useProjectStore.getState().lines.map((line) => [line.id, line.text])).toEqual([
        ["a", "Alpha"],
        ["c", "Charlie!"],
      ]);
    });

    it("regression: a line Done created from a paragraph with a hand-typed key keeps its id on the next Done", () => {
      useProjectStore.setState({
        lines: [
          createLine({ id: "a", text: "Alpha", begin: 1, end: 2 }),
          createLine({ id: "c", text: "Charlie", begin: 3, end: 4 }),
        ],
      });
      const edited = generateProjectTtml(useProjectStore.getState(), 0)
        .replace("<div>", "<div><!-- note -->")
        .replace(
          "\n    </div>",
          '\n      <p begin="0:05.000" end="0:06.000" itunes:key="X" ttm:agent="v1">Extra</p>\n    </div>',
        );
      expect(applyEditedTtml(edited, 0)).toMatchObject({ status: "applied", keptInExport: true });
      const created = useProjectStore.getState().lines.find((line) => line.text === "Extra");
      const kept = useProjectStore.getState().ttmlEditState;
      const again = kept?.content.replace(">Charlie<", ">Charlie!<") ?? "";
      useProjectStore.getState().setTtmlEditState({ source: kept?.source ?? "", content: again });
      expect(applyEditedTtml(again, 0)).toMatchObject({ status: "applied" });
      expect(useProjectStore.getState().lines.find((line) => line.text === "Extra")).toEqual(created);
    });
  });
});
