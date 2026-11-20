import { describe, expect, it } from "vitest";
import { isProjectFullySynced } from "@/domain/line/sync-progress";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, timedSyllables } from "@/domain/line/track";
import { mergeEditedExport } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines · background vocals", () => {
  describe("regressions", () => {
    it("regression: does not store background words seeded from the line bounds", () => {
      const stored = [
        createLine({ id: "a", text: "Main", begin: 1, end: 2, backgroundText: "ooh", backgroundTextSource: "manual" }),
      ];
      const merged = mergeEditedExport(stored);
      expect(backgroundText(merged[0]!)).toBe("ooh");
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
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">ooh yeah<", ">ooh no<"));
      expect(backgroundText(merged[0]!)).toBe("ooh no");
      expect(merged[0]?.backgroundWords).toBeUndefined();
      expect(isProjectFullySynced(merged)).toBe(true);
    });

    it("stores background words the edit timed on its own", () => {
      const stored = [createLine({ id: "a", text: "Hello", begin: 1, end: 2, backgroundText: "ooh" })];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace(
          '<span begin="0:01.000" end="0:02.000">ooh</span>',
          '<span begin="0:01.200" end="0:01.800">ahh</span>',
        ),
      );
      expect(timedSyllables(backgroundTrack(merged[0]!)).map((word) => [word.text, word.begin, word.end])).toEqual([
        ["ahh", 1.2, 1.8],
      ]);
    });

    it("regression: a line the edit adds with a background text stores only the text", () => {
      const stored = [createLine({ id: "a", text: "One", begin: 1, end: 2 })];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace(
          "</div>",
          '<p begin="0:04.000" end="0:05.000" ttm:agent="v1">New<span ttm:role="x-bg"><span begin="0:04.000" end="0:05.000">ooh</span></span></p></div>',
        ),
      );
      expect(lineText(merged[1]!)).toBe("New");
      expect(backgroundText(merged[1]!)).toBe("ooh");
      expect(merged[1]?.backgroundWords).toBeUndefined();
      expect(isProjectFullySynced(merged)).toBe(true);
    });

    it("regression: an edited line next to an added line stores no seeded background words", () => {
      const stored = [
        createLine({
          id: "a",
          text: "One",
          begin: 1,
          end: 2,
          backgroundText: "ooh yeah",
          backgroundTextSource: "manual",
        }),
      ];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml
          .replace(">One<", ">One!<")
          .replace("</div>", '<p begin="0:04.000" end="0:05.000" ttm:agent="v1">Two</p></div>'),
      );
      expect(merged[0]?.backgroundWords).toBeUndefined();
      expect(isProjectFullySynced(merged)).toBe(true);
    });

    it("takes background word timing the edit gave a line without background words", () => {
      const stored = [createLine({ id: "a", text: "Hello", begin: 1, end: 2, backgroundText: "ooh" })];
      const merged = mergeEditedExport(stored, (ttml) =>
        ttml.replace(
          '<span begin="0:01.000" end="0:02.000">ooh</span>',
          '<span begin="0:01.200" end="0:01.800">ooh</span>',
        ),
      );
      expect(timedSyllables(backgroundTrack(merged[0]!)).map((word) => [word.text, word.begin, word.end])).toEqual([
        ["ooh", 1.2, 1.8],
      ]);
    });
  });
});
