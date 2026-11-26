import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { withMainTrack, withRoleWords, withTrackText } from "@/domain/line/track-writes";
import { mergeEditedExport } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";

// -- Fixtures -----------------------------------------------------------------

function syllableLine(): LyricLine {
  return createLine({
    id: "a",
    text: "Hel|lo world",
    words: [
      { text: "Hel", begin: 1.0004, end: 1.5, syllableGroupId: "s1" },
      { text: "lo", sep: " ", begin: 1.5, end: 2, syllableGroupId: "s1" },
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
      const words = (merged[0] && roleWords(merged[0], "main")) ?? [];
      expect(words[0]).toBe((stored[0] && roleWords(stored[0], "main"))?.[0]);
      expect(words[2]).toBe((stored[0] && roleWords(stored[0], "main"))?.[2]);
      expect(words[1]).toEqual({ text: "lo", sep: " ", begin: 1.6, end: 2, joinsNext: false });
      expect(lineText(merged[0]!)).toBe("Hel|lo world");
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
            { text: "ooh", sep: " ", begin: 1.0004, end: 2, syllableGroupId: "b1" },
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
      const words = (merged[0] && roleWords(merged[0], "bg")) ?? [];
      expect(words[0]).toBe((stored[0] && roleWords(stored[0], "bg"))?.[0]);
      expect(words[1]).toEqual({ text: "ahh", sep: "", begin: 2, end: 2.8, joinsNext: false });
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
            { text: "yeah", sep: " ", begin: 1.0004, end: 1.5 },
            { text: "o", begin: 1.5, end: 1.8, syllableGroupId: "b1" },
            { text: "oh", begin: 1.8, end: 2.0004, syllableGroupId: "b1" },
          ],
        }),
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">oh</span></span>", ">ohh</span></span>"));
      const words = (merged[0] && roleWords(merged[0], "bg")) ?? [];
      expect(words[0]).toBe((stored[0] && roleWords(stored[0], "bg"))?.[0]);
      expect(words[1]).toBe((stored[0] && roleWords(stored[0], "bg"))?.[1]);
      expect(words[2]).toEqual({ text: "ohh", sep: "", begin: 1.8, end: 2, joinsNext: false });
      expect(backgroundText(merged[0]!)).toBe("yeah o|ohh");
    });
  });

  describe("edge cases", () => {
    it("takes every edited word when the edit changes the number of words", () => {
      const stored = [syllableLine()];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(/<span begin="0:02.000"[^>]*>world<\/span>/, ""));
      expect(timedSyllables(mainTrack(merged[0]!)).map((word) => word.text.trim())).toEqual(["Hel", "lo"]);
    });

    it("takes every edited word when the edit changes where the spaces are", () => {
      const stored = [syllableLine()];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace("</span><span", "</span> <span"));
      const words = (merged[0] && roleWords(merged[0], "main")) ?? [];
      expect(words.map((word) => word.text + word.sep)).toEqual(["Hel ", "lo ", "world"]);
      expect(words[0]?.joinsNext).toBe(false);
    });
  });

  describe("invariants", () => {
    it("keeps the stored word array when no word changed", () => {
      const stored = [syllableLine(), createLine({ id: "b", text: "Other", begin: 3, end: 4 })];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Other<", ">Other2<"));
      expect(timedSyllables(mainTrack(merged[0]!))).toBe(timedSyllables(mainTrack(stored[0])));
    });
  });

  it("regression: a partly synced line typed longer keeps every syllable and no two share an id", () => {
    const loaded = createLine({ id: "a", text: "a b" });
    const [first] = mainTrack(loaded).syllables;
    const tapped = withRoleWords(loaded, "main", [{ ...first, begin: 1, end: 2 }]);
    const typed = withMainTrack(tapped, withTrackText(mainTrack(tapped), "a b c d"));

    const merged = mergeEditedExport([typed], (ttml) => ttml.replace('end="0:02.000"', 'end="0:02.500"'))[0]!;

    const ids = mainTrack(merged).syllables.map((syllable) => syllable.id);
    expect(lineText(merged)).toBe("a b c d");
    expect(new Set(ids).size).toBe(ids.length);
  });
});
