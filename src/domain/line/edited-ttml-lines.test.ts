import { holdsEveryLine, mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import { mergeEditedExport, ownExportLines } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const SPANISH = { language: "es", text: "Hola", origin: "manual" as const, sourceFingerprint: "fp-1" };

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines", () => {
  it("keeps the stored lines as they were when nothing was edited", () => {
    const stored = [
      createLine({ id: "a", text: "Hello", begin: 1.2345, end: 2.5 }),
      createLine({
        id: "b",
        text: "wo|rld",
        words: [
          { text: "wo", begin: 3, end: 3.5, syllableGroupId: "g1" },
          { text: "rld", begin: 3.5, end: 4, syllableGroupId: "g1" },
        ],
      }),
    ];
    expect(mergeEditedExport(stored)).toEqual(stored);
  });

  it("takes the edited text and keeps the stored line id", () => {
    const stored = [
      createLine({ id: "a", text: "Hello", begin: 1, end: 2 }),
      createLine({ id: "b", text: "World", begin: 2, end: 3 }),
    ];
    const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Hello<", ">Hello there<"));
    expect(merged.map((line) => [line.id, line.text])).toEqual([
      ["a", "Hello there"],
      ["b", "World"],
    ]);
  });

  it("takes an edited word timing", () => {
    const stored = [createLine({ id: "a", text: "Hi", words: [{ text: "Hi", begin: 1, end: 2 }] })];
    const merged = mergeEditedExport(stored, (ttml) => ttml.replaceAll('end="0:02.000"', 'end="0:02.500"'));
    expect(merged[0]?.words?.[0]?.end).toBe(2.5);
  });

  describe("edge cases", () => {
    it("keeps stored lines paired when lines are added, giving new lines their own ids", () => {
      const stored = [
        createLine({ id: "a", text: "Hello", begin: 1, end: 2 }),
        createLine({ id: "b", text: "World", begin: 2, end: 3 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace("</div>", '<p begin="0:04.000" end="0:05.000" ttm:agent="v1">Added</p></div>'),
      );
      expect(merged.map((line) => line.text)).toEqual(["Hello", "World", "Added"]);
      expect(merged[0]?.id).toBe("a");
      expect(merged[1]?.id).toBe("b");
      expect(["a", "b"]).not.toContain(merged[2]?.id);
    });

    it("returns nothing for an empty edit", () => {
      expect(mergeEditedTtmlLines([createLine({ text: "Hello", begin: 1, end: 2 })], { lines: [] })).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("never reuses a stored id twice", () => {
      const stored = [
        createLine({ id: "a", text: "Same", begin: 1, end: 2 }),
        createLine({ id: "b", text: "Same", begin: 2, end: 3 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace("</div>", '<p begin="0:04.000" end="0:05.000" ttm:agent="v1">Same</p></div>'),
      );
      const ids = merged.map((line) => line.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});

describe("holdsEveryLine", () => {
  it("holds a project the export carries in full", () => {
    const stored = [
      createLine({ id: "a", text: "Hel|lo world", begin: 1, end: 2, backgroundText: "ooh" }),
      createLine({ id: "blank", text: "" }),
      {
        ...createLine({
          id: "b",
          text: "wo|rld",
          words: [
            { text: "wo", begin: 3, end: 3.5, syllableGroupId: "g1" },
            { text: "rld", begin: 3.5, end: 4, syllableGroupId: "g1" },
          ],
        }),
        translations: {
          es: SPANISH,
          fr: { language: "fr", text: "", origin: "manual" as const, sourceFingerprint: "x" },
        },
      },
    ];
    expect(holdsEveryLine(stored, ownExportLines(stored))).toBe(true);
  });

  describe("regressions", () => {
    it("regression: does not hold a line with a field the export does not carry", () => {
      const stored = [
        { ...createLine({ id: "a", text: "Hello", begin: 1, end: 2 }), detached: true },
        createLine({ id: "b", text: "World", begin: 2, end: 3 }),
      ];
      expect(holdsEveryLine(stored, ownExportLines(stored))).toBe(false);
    });
  });

  describe("error paths", () => {
    it("does not hold when the export has a different number of lines", () => {
      const stored = [createLine({ id: "a", text: "Hello", begin: 1, end: 2 })];
      expect(holdsEveryLine(stored, [])).toBe(false);
      expect(holdsEveryLine(stored, [...ownExportLines(stored), ...ownExportLines(stored)])).toBe(false);
    });
  });
});
