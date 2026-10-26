import { isSectionTagLine, readGeniusLyrics, readsAsGeniusLyrics } from "@/domain/lyrics-file/genius-text";
import { GENIUS_PAGE_COPY, TAGGED_LYRICS } from "@/test/genius-fixtures";
import { describe, expect, it } from "vitest";

const texts = (content: string) => readGeniusLyrics(content).lines.map((line) => line.text);

describe("readsAsGeniusLyrics", () => {
  it("reads a Genius page copy and tagged lyrics", () => {
    expect(readsAsGeniusLyrics(GENIUS_PAGE_COPY)).toBe(true);
    expect(readsAsGeniusLyrics(TAGGED_LYRICS)).toBe(true);
  });

  describe("regressions", () => {
    it("regression: one stray section tag stays plain text", () => {
      expect(readsAsGeniusLyrics("[Chorus]\nHello")).toBe(false);
    });

    it("regression: brackets that are not section tags stay plain text", () => {
      expect(readsAsGeniusLyrics("[laughs]\nHello\n[sighs]\nBye")).toBe(false);
    });
  });
});

describe("isSectionTagLine", () => {
  it("matches whole-line Genius section tags only", () => {
    expect(isSectionTagLine("[Pre-Chorus: Drake]")).toBe(true);
    expect(isSectionTagLine("  [verse 2]  ")).toBe(true);
    expect(isSectionTagLine("Hello [Chorus]")).toBe(false);
    expect(isSectionTagLine("[laughs]")).toBe(false);
  });
});

describe("readGeniusLyrics", () => {
  it("drops tags, the page header, inline promos and the Embed counter", () => {
    expect(texts(GENIUS_PAGE_COPY)).toEqual([
      "Yeah, yeah",
      "",
      "Midnight rain on the window glass",
      "Counting the hours as they pass",
      "Hold on, we're almost home tonight",
      "",
      "Streetlights flicker in the morning haze",
      "",
      "We'll remember these golden days",
    ]);
  });

  it("keeps lyrics before the first tag when there is no page header", () => {
    expect(texts("Opening line\n[Verse 1]\nNext\n[Chorus]\nLast")).toEqual(["Opening line", "Next", "Last"]);
  });

  describe("edge cases", () => {
    it("drops a last line that held only the Embed counter", () => {
      expect(texts("[Verse]\nA\n[Chorus]\nB\n12Embed")).toEqual(["A", "B"]);
    });

    it("strips Embed only from the last lyric", () => {
      expect(texts("[Verse]\nI embed\n[Chorus]\nB")).toEqual(["I embed", "B"]);
    });

    it("never leaves leading or trailing blank lines", () => {
      expect(texts("[Verse]\n\nA\n\n[Chorus]\n")).toEqual(["A"]);
    });
  });
});
