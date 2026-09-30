import type { LyricLine } from "@/domain/line/model";
import { mergeEditedExport } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function syllableLine(): LyricLine {
  return createLine({
    id: "a",
    text: "Hel|lo world",
    words: [
      { text: "Hel", begin: 1.0004, end: 1.5, syllableGroupId: "s1" },
      { text: "lo ", begin: 1.5, end: 2, syllableGroupId: "s1" },
      { text: "world", begin: 2.0002, end: 3, explicit: true },
    ],
  });
}

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines · word timing", () => {
  describe("regressions", () => {
    it("regression: editing one word timing keeps the other words as stored", () => {
      const stored = [syllableLine()];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace('begin="0:01.500"', 'begin="0:01.600"'));
      const words = merged[0]?.words ?? [];
      expect(words[0]).toBe(stored[0]?.words?.[0]);
      expect(words[2]).toBe(stored[0]?.words?.[2]);
      expect(words[1]).toEqual({ text: "lo ", begin: 1.6, end: 2, syllableGroupId: "s1" });
      expect(merged[0]?.text).toBe("Hel|lo world");
    });

    it("regression: editing one background word timing keeps the other background words as stored", () => {
      const stored = [
        createLine({
          id: "a",
          text: "Main",
          begin: 1,
          end: 3,
          backgroundText: "ooh ahh",
          backgroundWords: [
            { text: "ooh ", begin: 1.0004, end: 2, syllableGroupId: "b1" },
            { text: "ahh", begin: 2, end: 3 },
          ],
        }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace(
          '<span begin="0:02.000" end="0:03.000">ahh</span>',
          '<span begin="0:02.000" end="0:02.800">ahh</span>',
        ),
      );
      const words = merged[0]?.backgroundWords ?? [];
      expect(words[0]).toBe(stored[0]?.backgroundWords?.[0]);
      expect(words[1]).toEqual({ text: "ahh", begin: 2, end: 2.8 });
    });
  });

  describe("regressions: background text", () => {
    it("regression: editing one background word's text keeps the other background words as stored", () => {
      const stored = [
        createLine({
          id: "a",
          text: "Main",
          begin: 1,
          end: 3,
          backgroundText: "yeah o|oh",
          backgroundWords: [
            { text: "yeah ", begin: 1.0004, end: 1.5 },
            { text: "o", begin: 1.5, end: 1.8, syllableGroupId: "b1" },
            { text: "oh", begin: 1.8, end: 2.0004, syllableGroupId: "b1" },
          ],
        }),
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">oh</span></span>", ">ohh</span></span>"));
      const words = merged[0]?.backgroundWords ?? [];
      expect(words[0]).toBe(stored[0]?.backgroundWords?.[0]);
      expect(words[1]).toBe(stored[0]?.backgroundWords?.[1]);
      expect(words[2]).toEqual({ text: "ohh", begin: 1.8, end: 2, syllableGroupId: "b1" });
      expect(merged[0]?.backgroundText).toBe("yeah o|ohh");
    });
  });

  describe("edge cases", () => {
    it("takes every edited word when the edit changes the number of words", () => {
      const stored = [syllableLine()];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(/<span begin="0:02.000"[^>]*>world<\/span>/, ""));
      expect(merged[0]?.words?.map((word) => word.text.trim())).toEqual(["Hel", "lo"]);
    });

    it("takes every edited word when the edit changes where the spaces are", () => {
      const stored = [syllableLine()];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace("</span><span", "</span> <span"));
      const words = merged[0]?.words ?? [];
      expect(words.map((word) => word.text)).toEqual(["Hel ", "lo ", "world"]);
      expect(words[0]?.syllableGroupId).toBeUndefined();
    });
  });

  describe("invariants", () => {
    it("keeps the stored word array when no word changed", () => {
      const stored = [syllableLine(), createLine({ id: "b", text: "Other", begin: 3, end: 4 })];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Other<", ">Other2<"));
      expect(merged[0]?.words).toBe(stored[0]?.words);
    });
  });
});
