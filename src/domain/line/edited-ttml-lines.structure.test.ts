import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import { mergeEditedExport } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const PARAGRAPH = /<p [^>]*>[\s\S]*?<\/p>/g;

function swapFirstTwoParagraphs(ttml: string): string {
  const [first, second] = ttml.match(PARAGRAPH) ?? [];
  if (!first || !second) throw new Error("expected two paragraphs");
  return ttml.replace(first, "\u0000").replace(second, first).replace("\u0000", second);
}

const SPANISH = { language: "es", text: "Hola", origin: "manual" as const, sourceFingerprint: "fp-1" };

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

    it("keeps stored lines and their split characters paired when a line without a key is added", () => {
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
      expect(
        mergeEditedTtmlLines([createLine({ id: "a", text: "One", begin: 1, end: 2 }), blank], { lines: [] }),
      ).toEqual([blank]);
    });
  });

  describe("regressions: pairing", () => {
    it("regression: reordered lines keep their ids and split characters", () => {
      const stored = [
        createLine({ id: "a", text: "Hel|lo", begin: 1, end: 2 }),
        createLine({ id: "b", text: "Wor|ld", begin: 2, end: 3 }),
        createLine({ id: "c", text: "End", begin: 3, end: 4 }),
      ];
      const merged = mergeEditedExport(stored, swapFirstTwoParagraphs);
      expect(merged.map((line) => [line.id, line.text])).toEqual([
        ["b", "Wor|ld"],
        ["a", "Hel|lo"],
        ["c", "End"],
      ]);
      expect(merged[0]).toBe(stored[1]);
      expect(merged[1]).toBe(stored[0]);
    });

    it("regression: deleting one copy of a repeated line keeps the other copy and the blank lines in place", () => {
      const stored = [
        createLine({ id: "chorus-1", text: "La|la", begin: 1, end: 2 }),
        createLine({ id: "blank-1", text: "" }),
        createLine({ id: "verse", text: "Verse", begin: 2, end: 3 }),
        createLine({ id: "chorus-2", text: "Lal|a", begin: 3, end: 4 }),
        createLine({ id: "blank-2", text: "" }),
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(/<p [^>]*>Lala<\/p>/, ""));
      expect(merged.map((line) => line.id)).toEqual(["blank-1", "verse", "chorus-2", "blank-2"]);
      expect(merged[2]).toBe(stored[3]);
    });

    it("regression: adding a line and editing another in one edit keeps the edited line's stored data", () => {
      const stored = [
        {
          ...createLine({
            id: "one",
            text: "One",
            begin: 1,
            end: 2,
            backgroundText: "ooh",
            backgroundTextSource: "extraction",
          }),
          translations: { es: SPANISH },
        },
        createLine({ id: "blank", text: "" }),
        createLine({ id: "two", text: "Two", begin: 2, end: 3 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml
          .replace(">One<", ">One!<")
          .replace("</div>", '<p begin="0:04.000" end="0:05.000" ttm:agent="v1">Three</p></div>'),
      );
      expect(merged.map((line) => line.text)).toEqual(["One!", "", "Two", "Three"]);
      expect(merged.slice(0, 3).map((line) => line.id)).toEqual(["one", "blank", "two"]);
      expect(merged[0]?.translations?.es).toEqual(SPANISH);
      expect(merged[0]?.backgroundTextSource).toBe("extraction");
      expect(merged[0]?.backgroundWords).toBeUndefined();
    });

    it("pairs an edited line with the stored line at its place between unchanged lines", () => {
      const stored = [
        createLine({ id: "a", text: "One", begin: 1, end: 2 }),
        createLine({ id: "b", text: "Two", begin: 2, end: 3 }),
        createLine({ id: "c", text: "Three", begin: 3, end: 4 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace(">Two<", ">Deux<").replace("<div>", '<div><p begin="0:00.000" end="0:01.000">Zero</p>'),
      );
      expect(merged.map((line) => line.text)).toEqual(["Zero", "One", "Deux", "Three"]);
      expect(merged.slice(1).map((line) => line.id)).toEqual(["a", "b", "c"]);
    });
  });
});
