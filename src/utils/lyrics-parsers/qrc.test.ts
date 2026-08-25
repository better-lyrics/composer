import { describe, expect, it } from "vitest";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { parseQrc } from "@/utils/lyrics-parsers/qrc";
import { getSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

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

  describe("metadata", () => {
    it("lifts header tags into project metadata", () => {
      const result = parseQrc(WANDERLUST_QRC);
      expect(result.metadata.title).toBe("Wanderlust");
      expect(result.metadata.artists).toEqual(["The Weeknd"]);
      expect(result.metadata.album).toBe("Kiss Land");
    });

    it("does not mistake a line header for a metadata tag", () => {
      const result = parseQrc("[34059,2299]Is (34059,2299)");
      expect(result.metadata.title).toBeUndefined();
    });

    it("shifts line and word timing by the header offset", () => {
      const result = parseQrc("[offset:1000]\n[34059,2299]Is (34059,130)it (34189,2170)");
      expect(result.lines[0].words?.[0].begin).toBeCloseTo(35.059, 9);
      expect(result.lines[0].words?.[0].end).toBeCloseTo(35.189, 9);
      expect(result.lines[0].words?.[1].end).toBeCloseTo(37.359, 9);
    });

    it("shifts a line-synced line by the header offset", () => {
      const result = parseQrc("[offset:1000]\n[1000,2500]No word tags here");
      expect(result.lines[0].begin).toBe(2);
      expect(result.lines[0].end).toBe(4.5);
    });

    it("clamps a negative offset so no time drops below zero", () => {
      const result = parseQrc("[offset:-60000]\n[34059,2299]Is (34059,130)it (34189,2170)");
      expect(result.lines[0].words?.[0].begin).toBe(0);
      expect(result.lines[0].words?.[0].end).toBe(0);
    });

    it("leaves timing untouched when the offset is zero", () => {
      const result = parseQrc("[offset:0]\n[34059,2299]Is (34059,130)it (34189,2170)");
      expect(result.lines[0].words?.[0].begin).toBe(34.059);
      expect(result.lines[0].words?.[0].end).toBe(34.189);
    });
  });

  describe("edge cases", () => {
    it("joins spaceless CJK syllables with the split character", () => {
      const splitChar = getSplitCharacter();
      const result = parseQrc("[1000,1500]我(1000,500)们(1500,500)走(2000,500)");
      expect(result.lines[0].text).toBe(`我${splitChar}们${splitChar}走`);
      expect(result.lines[0].words?.map((word) => word.text)).toEqual(["我", "们", "走"]);
    });

    it("keeps the trailing space a final word carries", () => {
      const result = parseQrc("[1000,2000]Hello (1000,500)world (1500,500)");
      expect(result.lines[0].text).toBe("Hello world ");
    });

    it("splits lines on CRLF without leaking the separator into a word", () => {
      const result = parseQrc("[1000,500]Hi (1000,250)there(1250,250)\r\n[2000,500]Bye(2000,500)");
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].words?.at(-1)?.text).toBe("there");
      expect(result.lines[1].words?.map((word) => word.text)).toEqual(["Bye"]);
    });

    it("falls back to line timing when text trails the final word tag", () => {
      const result = parseQrc("[1000,2000]Hello (1000,500)world");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].text).toBe("Hello world");
      expect(result.lines[0].words).toBeUndefined();
      expect(result.lines[0].begin).toBe(1);
      expect(result.lines[0].end).toBe(3);
    });

    it("drops a header whose body is empty", () => {
      const result = parseQrc("[1000,500]\n[2000,500]Bye(2000,500)");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].text).toBe("Bye");
    });
  });

  describe("invariants", () => {
    it("line text always equals the reconstruction of its words", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const splitChar = getSplitCharacter();
      for (const line of result.lines) {
        if (!line.words?.length) continue;
        expect(line.text).toBe(reconstructLineText(line.words, splitChar));
      }
    });

    it("never returns a line that is both word-synced and line-synced", () => {
      const result = parseQrc(WANDERLUST_QRC);
      for (const line of result.lines) {
        if (line.words) expect(line.begin).toBeUndefined();
      }
    });

    it("orders every word within a line and never inverts a word's own bounds", () => {
      const result = parseQrc(WANDERLUST_QRC);
      for (const line of result.lines) {
        const words = line.words ?? [];
        for (let i = 0; i < words.length; i++) {
          expect(words[i].end).toBeGreaterThanOrEqual(words[i].begin);
          if (i > 0) expect(words[i].begin).toBeGreaterThanOrEqual(words[i - 1].begin);
        }
      }
    });

    it("reports no agents at this stage", () => {
      const result = parseQrc(WANDERLUST_QRC);
      expect(result.agents).toBeUndefined();
    });
  });

  describe("error paths", () => {
    it("returns nothing for empty input", () => {
      const result = parseQrc("");
      expect(result.lines).toEqual([]);
      expect(result.hasTimingData).toBe(false);
    });

    it("reads a malformed QrcInfos document as a raw body", () => {
      const result = parseQrc('<QrcInfos><LyricInfo LyricCount="1"></QrcInfos>\n[1000,500]Hi (1000,500)');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].words?.map((word) => word.text)).toEqual(["Hi "]);
    });

    it("returns nothing when QrcInfos carries no LyricContent attribute", () => {
      const result = parseQrc('<QrcInfos><LyricInfo LyricCount="1"/></QrcInfos>');
      expect(result.lines).toEqual([]);
      expect(result.hasTimingData).toBe(false);
    });

    it("keeps a line with no word tags as line-synced", () => {
      const result = parseQrc("[1000,2500]No word tags here");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].text).toBe("No word tags here");
      expect(result.lines[0].words).toBeUndefined();
      expect(result.lines[0].begin).toBe(1);
      expect(result.lines[0].end).toBe(3.5);
      expect(result.hasTimingData).toBe(true);
    });

    it("ignores header tags that are not a line header", () => {
      const result = parseQrc("[ti:Wanderlust]\n[offset:0]\n[1000,500]Hi (1000,500)");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].text).toBe("Hi ");
    });
  });
});
