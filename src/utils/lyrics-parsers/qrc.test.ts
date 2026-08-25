import { describe, expect, it } from "vitest";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { parseQrc } from "@/utils/lyrics-parsers/qrc";

// -- Helpers ------------------------------------------------------------------

const FIRST_LYRIC_TEXT = "Is it so hard to say the same thing";

// -- Tests --------------------------------------------------------------------

describe("parseQrc", () => {
  describe("lines and words", () => {
    // Tightened to exactly 84 in Task 5, once credits and markers are filtered out.
    it("parses the lyric lines from a real QRC document", () => {
      const result = parseQrc(WANDERLUST_QRC);
      expect(result.lines.length).toBeGreaterThan(80);
      expect(result.hasTimingData).toBe(true);
    });

    it("reads word timing that trails the word it belongs to", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const first = result.lines.find((line) => line.text === FIRST_LYRIC_TEXT);
      expect(first).toBeDefined();
      expect(first?.words?.[0]).toEqual({ text: "Is ", begin: 34.059, end: 34.189 });
      expect(first?.words?.[1]).toEqual({ text: "it ", begin: 34.189, end: 34.309 });
      expect(first?.words?.at(-1)).toEqual({ text: "thing", begin: 35.42, end: 36.358 });
    });

    it("converts milliseconds to seconds", () => {
      const result = parseQrc("[34059,2299]Is (34059,130)it (34189,120)");
      expect(result.lines[0].words?.[0].begin).toBe(34.059);
      expect(result.lines[0].words?.[0].end).toBe(34.189);
    });

    it("preserves trailing spaces as word separators", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const first = result.lines.find((line) => line.text === FIRST_LYRIC_TEXT);
      const words = first?.words ?? [];
      expect(words.map((word) => word.text).join("")).toBe(FIRST_LYRIC_TEXT);
    });

    it("parses a document whose body is not wrapped in QrcInfos XML", () => {
      const result = parseQrc("[34059,2299]Is (34059,130)it (34189,2170)");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].words).toHaveLength(2);
    });
  });
});
