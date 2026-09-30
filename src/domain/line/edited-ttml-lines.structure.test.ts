import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import { mergeEditedExport } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines · line structure", () => {
  describe("regressions: split characters", () => {
    it("regression: keeps an unedited line-synced line exactly as stored, split characters included", () => {
      const stored = [
        createLine({ id: "a", text: "Hel|lo world", begin: 1, end: 2 }),
        createLine({ id: "b", text: "Other", begin: 2, end: 3 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Other<", ">Other2<"));
      expect(merged[0]).toBe(stored[0]);
      expect(merged[1]?.text).toBe("Other2");
    });

    it("regression: an edited line keeps its split characters when its text did not change", () => {
      const stored = [createLine({ id: "a", text: "Hel|lo world", begin: 1, end: 2 })];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace('end="0:02.000"', 'end="0:02.500"'));
      expect(merged[0]?.text).toBe("Hel|lo world");
      expect(merged[0]?.end).toBe(2.5);
    });

    it("takes the edited text when the edit changed it", () => {
      const stored = [createLine({ id: "a", text: "Hel|lo world", begin: 1, end: 2 })];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Hello world<", ">Hello there<"));
      expect(merged[0]?.text).toBe("Hello there");
    });

    it("pairs lines by text without their split characters when lines were added", () => {
      const stored = [
        createLine({ id: "a", text: "Hel|lo", begin: 1, end: 2 }),
        createLine({ id: "b", text: "World", begin: 2, end: 3 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace("<div>", '<div><p begin="0:00.000" end="0:01.000" ttm:agent="v1">Intro</p>'),
      );
      expect(merged.map((line) => line.id).slice(1)).toEqual(["a", "b"]);
      expect(merged[1]).toBe(stored[0]);
    });
  });

  describe("regressions: lines the export skips", () => {
    it("regression: keeps blank, whitespace-only and split-character-only lines in place", () => {
      const stored = [
        createLine({ id: "a", text: "One", begin: 1, end: 2 }),
        createLine({ id: "blank", text: "" }),
        createLine({ id: "b", text: "Two", begin: 2, end: 3 }),
        createLine({ id: "spaces", text: "   " }),
        createLine({ id: "split", text: "|" }),
        createLine({ id: "c", text: "Three", begin: 3, end: 4 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Two<", ">Two2<"));
      expect(merged.map((line) => line.id)).toEqual(["a", "blank", "b", "spaces", "split", "c"]);
      expect(merged[1]).toBe(stored[1]);
      expect(merged[3]).toBe(stored[3]);
      expect(merged[4]).toBe(stored[4]);
      expect(merged[2]?.text).toBe("Two2");
    });

    it("regression: keeps lines before the first exported line at the start", () => {
      const stored = [createLine({ id: "blank", text: "" }), createLine({ id: "a", text: "One", begin: 1, end: 2 })];
      expect(mergeEditedExport(stored)).toEqual(stored);
    });

    it("regression: keeps a skipped line when the line before it was deleted", () => {
      const stored = [
        createLine({ id: "a", text: "One", begin: 1, end: 2 }),
        createLine({ id: "b", text: "Two", begin: 2, end: 3 }),
        createLine({ id: "blank", text: "" }),
        createLine({ id: "c", text: "Three", begin: 3, end: 4 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(/<p[^>]*>Two<\/p>/, ""));
      expect(merged.map((line) => line.id)).toEqual(["a", "blank", "c"]);
    });

    it("keeps skipped lines when every exported line was deleted", () => {
      const blank = createLine({ id: "blank", text: "" });
      expect(mergeEditedTtmlLines([createLine({ id: "a", text: "One", begin: 1, end: 2 }), blank], [])).toEqual([
        blank,
      ]);
    });
  });
});
