import type { LyricLine } from "@/domain/line/model";
import { mergeEditedExport } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const BRAVO_SPANISH = { language: "es", text: "Bravo es", origin: "manual" as const, sourceFingerprint: "fp-b" };

function bravo(): LyricLine {
  return {
    ...createLine({
      id: "b",
      text: "Bra|vo",
      begin: 3,
      end: 4,
      backgroundText: "ooh",
      backgroundTextSource: "extraction",
    }),
    translations: { es: BRAVO_SPANISH },
  };
}

function paragraphs(ttml: string): string[] {
  return ttml.match(/<p [^>]*>[\s\S]*?<\/p>/g) ?? [];
}

function expectBravoKeptItsData(merged: LyricLine[]): void {
  const line = merged.find((candidate) => candidate.text === "Bravo!");
  expect(line?.id).toBe("b");
  expect(line?.translations?.es).toEqual(BRAVO_SPANISH);
  expect(line?.backgroundTextSource).toBe("extraction");
}

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines · pairing edited lines", () => {
  describe("regressions", () => {
    it("regression: deleting a line and editing its neighbour keeps the neighbour's id and data", () => {
      const stored = [
        createLine({ id: "a", text: "Alpha", begin: 1, end: 2 }),
        {
          ...createLine({ id: "k", text: "Kay", begin: 2, end: 3 }),
          translations: { es: { ...BRAVO_SPANISH, text: "Ka" } },
        },
        bravo(),
        createLine({ id: "z", text: "Zulu", begin: 4, end: 5 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace(paragraphs(ttml)[1] ?? "", "").replace(">Bravo<", ">Bravo!<"),
      );
      expect(merged.map((line) => line.id)).toEqual(["a", "b", "z"]);
      expectBravoKeptItsData(merged);
    });

    it("regression: adding a line before an edited line keeps the edited line's id and data", () => {
      const stored = [
        createLine({ id: "a", text: "Alpha", begin: 1, end: 2 }),
        bravo(),
        createLine({ id: "z", text: "Zulu", begin: 4, end: 5 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml
          .replace(paragraphs(ttml)[0] ?? "", `${paragraphs(ttml)[0]}<p begin="0:02.000" end="0:03.000">New</p>`)
          .replace(">Bravo<", ">Bravo!<"),
      );
      expect(merged.map((line) => line.text)).toEqual(["Alpha", "New", "Bravo!", "Zulu"]);
      expect(["a", "b", "z"]).not.toContain(merged[1]?.id);
      expectBravoKeptItsData(merged);
    });

    it("regression: reordering and editing a line keeps its id and translation origin", () => {
      const google = {
        language: "es",
        text: "Hola",
        origin: "google" as const,
        sourceFingerprint: "fp-h",
        stale: true,
      };
      const stored = [
        { ...createLine({ id: "h", text: "Hel|lo", begin: 1, end: 2 }), translations: { es: google } },
        createLine({ id: "w", text: "Wor|ld", begin: 2, end: 3 }),
        createLine({ id: "e", text: "End", begin: 3, end: 4 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) => {
        const [first = "", second = ""] = paragraphs(ttml);
        return ttml
          .replace(first, "\u0000")
          .replace(second, first)
          .replace("\u0000", second)
          .replace(">Hello<", ">Hello!<");
      });
      expect(merged.map((line) => [line.id, line.text])).toEqual([
        ["w", "Wor|ld"],
        ["h", "Hello!"],
        ["e", "End"],
      ]);
      expect(merged[1]?.translations?.es).toEqual(google);
    });
  });

  describe("edge cases", () => {
    it("gives a rewritten line with no similar stored line a new id when the counts differ", () => {
      const stored = [
        createLine({ id: "a", text: "Alpha", begin: 1, end: 2 }),
        createLine({ id: "k", text: "Kay", begin: 2, end: 3 }),
        createLine({ id: "q", text: "Quebec", begin: 3, end: 4 }),
        createLine({ id: "z", text: "Zulu", begin: 4, end: 5 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace(paragraphs(ttml)[1] ?? "", "").replace(">Quebec<", ">Totally different<"),
      );
      expect(merged.map((line) => line.text)).toEqual(["Alpha", "Totally different", "Zulu"]);
      expect(["k", "q"]).not.toContain(merged[1]?.id);
    });

    it("still pairs a rewritten line by position when its gap has one line on each side", () => {
      const stored = [
        createLine({ id: "a", text: "Alpha", begin: 1, end: 2 }),
        createLine({ id: "k", text: "Kay", begin: 2, end: 3 }),
        createLine({ id: "z", text: "Zulu", begin: 3, end: 4 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Kay<", ">Totally different<"));
      expect(merged.map((line) => line.id)).toEqual(["a", "k", "z"]);
    });
  });
});
