import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import type { LyricLine } from "@/domain/line/model";
import { isProjectFullySynced } from "@/domain/line/sync-progress";
import { createLine } from "@/test/factories";
import { PARSERS } from "@/utils/lyrics-parsers";
import { generateTTML } from "@/utils/ttml";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const METADATA = { title: "Song", artists: [], album: "", duration: 0 };

function exported(lines: LyricLine[]): string {
  return generateTTML({ metadata: METADATA, agents: DEFAULT_AGENTS, lines });
}

function roundTrip(stored: LyricLine[], edit: (ttml: string) => string = (ttml) => ttml): LyricLine[] {
  return mergeEditedTtmlLines(stored, PARSERS.ttml(edit(exported(stored))).lines);
}

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
    expect(roundTrip(stored)).toEqual(stored);
  });

  it("takes the edited text and keeps the stored line id", () => {
    const stored = [
      createLine({ id: "a", text: "Hello", begin: 1, end: 2 }),
      createLine({ id: "b", text: "World", begin: 2, end: 3 }),
    ];
    const merged = roundTrip(stored, (ttml) => ttml.replace(">Hello<", ">Hello there<"));
    expect(merged.map((line) => [line.id, line.text])).toEqual([
      ["a", "Hello there"],
      ["b", "World"],
    ]);
  });

  it("takes an edited word timing", () => {
    const stored = [createLine({ id: "a", text: "Hi", words: [{ text: "Hi", begin: 1, end: 2 }] })];
    const merged = roundTrip(stored, (ttml) => ttml.replaceAll('end="0:02.000"', 'end="0:02.500"'));
    expect(merged[0]?.words?.[0]?.end).toBe(2.5);
  });

  describe("regressions", () => {
    it("regression: keeps a translation's origin when its text did not change", () => {
      const stored = [{ ...createLine({ id: "a", text: "Hello", begin: 1, end: 2 }), translations: { es: SPANISH } }];
      expect(roundTrip(stored)[0]?.translations?.es).toEqual(SPANISH);
    });

    it("regression: takes an edited translation as the TTML gives it", () => {
      const stored = [{ ...createLine({ id: "a", text: "Hello", begin: 1, end: 2 }), translations: { es: SPANISH } }];
      const merged = roundTrip(stored, (ttml) => ttml.replace(">Hola<", ">Buenas<"));
      expect(merged[0]?.translations?.es?.text).toBe("Buenas");
    });

    it("regression: does not store background words seeded from the line bounds", () => {
      const stored = [
        createLine({ id: "a", text: "Main", begin: 1, end: 2, backgroundText: "ooh", backgroundTextSource: "manual" }),
      ];
      const merged = roundTrip(stored);
      expect(merged[0]?.backgroundText).toBe("ooh");
      expect(merged[0]?.backgroundWords).toBeUndefined();
      expect(merged).toEqual(stored);
    });

    it("regression: an edited background text on a line without background words stores only the text", () => {
      const stored = [
        createLine({
          id: "a",
          text: "Hello",
          begin: 1,
          end: 2,
          backgroundText: "ooh yeah",
          backgroundTextSource: "manual",
        }),
      ];
      const merged = roundTrip(stored, (ttml) => ttml.replace(">ooh yeah<", ">ooh no<"));
      expect(merged[0]?.backgroundText).toBe("ooh no");
      expect(merged[0]?.backgroundWords).toBeUndefined();
      expect(isProjectFullySynced(merged)).toBe(true);
    });

    it("stores background words the edit timed on its own", () => {
      const stored = [createLine({ id: "a", text: "Hello", begin: 1, end: 2, backgroundText: "ooh" })];
      const merged = roundTrip(stored, (ttml) =>
        ttml.replace(
          '<span begin="0:01.000" end="0:02.000">ooh</span>',
          '<span begin="0:01.200" end="0:01.800">ahh</span>',
        ),
      );
      expect(merged[0]?.backgroundWords?.map((word) => [word.text, word.begin, word.end])).toEqual([["ahh", 1.2, 1.8]]);
    });
  });

  describe("regressions: split characters", () => {
    it("regression: keeps an unedited line-synced line exactly as stored, split characters included", () => {
      const stored = [
        createLine({ id: "a", text: "Hel|lo world", begin: 1, end: 2 }),
        createLine({ id: "b", text: "Other", begin: 2, end: 3 }),
      ];
      const merged = roundTrip(stored, (ttml) => ttml.replace(">Other<", ">Other2<"));
      expect(merged[0]).toBe(stored[0]);
      expect(merged[1]?.text).toBe("Other2");
    });

    it("regression: an edited line keeps its split characters when its text did not change", () => {
      const stored = [createLine({ id: "a", text: "Hel|lo world", begin: 1, end: 2 })];
      const merged = roundTrip(stored, (ttml) => ttml.replace('end="0:02.000"', 'end="0:02.500"'));
      expect(merged[0]?.text).toBe("Hel|lo world");
      expect(merged[0]?.end).toBe(2.5);
    });

    it("takes the edited text when the edit changed it", () => {
      const stored = [createLine({ id: "a", text: "Hel|lo world", begin: 1, end: 2 })];
      const merged = roundTrip(stored, (ttml) => ttml.replace(">Hello world<", ">Hello there<"));
      expect(merged[0]?.text).toBe("Hello there");
    });

    it("pairs lines by text without their split characters when lines were added", () => {
      const stored = [
        createLine({ id: "a", text: "Hel|lo", begin: 1, end: 2 }),
        createLine({ id: "b", text: "World", begin: 2, end: 3 }),
      ];
      const merged = roundTrip(stored, (ttml) =>
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
      const merged = roundTrip(stored, (ttml) => ttml.replace(">Two<", ">Two2<"));
      expect(merged.map((line) => line.id)).toEqual(["a", "blank", "b", "spaces", "split", "c"]);
      expect(merged[1]).toBe(stored[1]);
      expect(merged[3]).toBe(stored[3]);
      expect(merged[4]).toBe(stored[4]);
      expect(merged[2]?.text).toBe("Two2");
    });

    it("regression: keeps lines before the first exported line at the start", () => {
      const stored = [createLine({ id: "blank", text: "" }), createLine({ id: "a", text: "One", begin: 1, end: 2 })];
      expect(roundTrip(stored)).toEqual(stored);
    });

    it("regression: keeps a skipped line when the line before it was deleted", () => {
      const stored = [
        createLine({ id: "a", text: "One", begin: 1, end: 2 }),
        createLine({ id: "b", text: "Two", begin: 2, end: 3 }),
        createLine({ id: "blank", text: "" }),
        createLine({ id: "c", text: "Three", begin: 3, end: 4 }),
      ];
      const merged = roundTrip(stored, (ttml) => ttml.replace(/<p[^>]*>Two<\/p>/, ""));
      expect(merged.map((line) => line.id)).toEqual(["a", "blank", "c"]);
    });

    it("keeps skipped lines when every exported line was deleted", () => {
      const blank = createLine({ id: "blank", text: "" });
      expect(mergeEditedTtmlLines([createLine({ id: "a", text: "One", begin: 1, end: 2 }), blank], [])).toEqual([
        blank,
      ]);
    });
  });

  describe("edge cases", () => {
    it("matches by text when lines were added, giving new lines their own ids", () => {
      const stored = [
        createLine({ id: "a", text: "Hello", begin: 1, end: 2 }),
        createLine({ id: "b", text: "World", begin: 2, end: 3 }),
      ];
      const merged = roundTrip(stored, (ttml) =>
        ttml.replace("</div>", '<p begin="0:04.000" end="0:05.000" ttm:agent="v1">Added</p></div>'),
      );
      expect(merged.map((line) => line.text)).toEqual(["Hello", "World", "Added"]);
      expect(merged[0]?.id).toBe("a");
      expect(merged[1]?.id).toBe("b");
      expect(["a", "b"]).not.toContain(merged[2]?.id);
    });

    it("returns nothing for an empty edit", () => {
      expect(mergeEditedTtmlLines([createLine({ text: "Hello", begin: 1, end: 2 })], [])).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("never reuses a stored id twice", () => {
      const stored = [
        createLine({ id: "a", text: "Same", begin: 1, end: 2 }),
        createLine({ id: "b", text: "Same", begin: 2, end: 3 }),
      ];
      const merged = roundTrip(stored, (ttml) =>
        ttml.replace("</div>", '<p begin="0:04.000" end="0:05.000" ttm:agent="v1">Same</p></div>'),
      );
      const ids = merged.map((line) => line.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
