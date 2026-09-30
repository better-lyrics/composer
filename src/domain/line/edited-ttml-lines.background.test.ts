import { isProjectFullySynced } from "@/domain/line/sync-progress";
import { mergeEditedExport } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines · background vocals", () => {
  describe("regressions", () => {
    it("regression: does not store background words seeded from the line bounds", () => {
      const stored = [
        createLine({ id: "a", text: "Main", begin: 1, end: 2, backgroundText: "ooh", backgroundTextSource: "manual" }),
      ];
      const merged = mergeEditedExport(stored);
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
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">ooh yeah<", ">ooh no<"));
      expect(merged[0]?.backgroundText).toBe("ooh no");
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
      expect(merged[0]?.backgroundWords?.map((word) => [word.text, word.begin, word.end])).toEqual([["ahh", 1.2, 1.8]]);
    });
  });
});
