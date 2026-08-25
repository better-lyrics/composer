import { describe, expect, it } from "vitest";
import { parseHeaderTags } from "@/utils/lyrics-parsers/qrc-metadata";

// -- Tests --------------------------------------------------------------------

describe("parseHeaderTags", () => {
  it("maps ti, ar and al to title, artists and album", () => {
    const tags = parseHeaderTags("[ti:Wanderlust]\r\n[ar:The Weeknd]\r\n[al:Kiss Land]\r\n[offset:0]");
    expect(tags.metadata.title).toBe("Wanderlust");
    expect(tags.metadata.artists).toEqual(["The Weeknd"]);
    expect(tags.metadata.album).toBe("Kiss Land");
  });

  it("records a by tag as the QRC transcriber", () => {
    expect(parseHeaderTags("[by:Kugou User]").metadata.extra).toEqual({ qrcTranscriber: "Kugou User" });
  });

  it("reads offset in milliseconds", () => {
    expect(parseHeaderTags("[offset:250]").offsetSeconds).toBe(0.25);
    expect(parseHeaderTags("[offset:-250]").offsetSeconds).toBe(-0.25);
    expect(parseHeaderTags("[offset:0]").offsetSeconds).toBe(0);
  });

  describe("edge cases", () => {
    it("defaults offset to zero when the tag is absent or unparseable", () => {
      expect(parseHeaderTags("[ti:Song]").offsetSeconds).toBe(0);
      expect(parseHeaderTags("[offset:abc]").offsetSeconds).toBe(0);
      expect(parseHeaderTags("[offset:]").offsetSeconds).toBe(0);
    });

    it("ignores an empty by tag", () => {
      expect(parseHeaderTags("[by:]").metadata.extra).toBeUndefined();
    });

    it("ignores a tag whose value is only whitespace", () => {
      const tags = parseHeaderTags("[ti:   ]\n[ar:\t]\n[al: ]");
      expect(tags.metadata).toEqual({});
    });

    it("reads a tag whatever its case", () => {
      const tags = parseHeaderTags("[TI:Wanderlust]\n[Ar:The Weeknd]\n[OFFSET:250]");
      expect(tags.metadata.title).toBe("Wanderlust");
      expect(tags.metadata.artists).toEqual(["The Weeknd"]);
      expect(tags.offsetSeconds).toBe(0.25);
    });

    it("keeps the last value when a tag repeats", () => {
      expect(parseHeaderTags("[ti:First]\n[ti:Second]").metadata.title).toBe("Second");
    });

    it("trims surrounding whitespace from a value", () => {
      expect(parseHeaderTags("[ti:  Wanderlust  ]").metadata.title).toBe("Wanderlust");
    });

    it("ignores a tag it does not know", () => {
      expect(parseHeaderTags("[kana:わんだ]").metadata).toEqual({});
    });
  });

  describe("invariants", () => {
    it("never returns an empty extra object", () => {
      expect(parseHeaderTags("[ti:Song]").metadata.extra).toBeUndefined();
    });

    it("does not mistake a line header for a metadata tag", () => {
      const tags = parseHeaderTags("[34059,2299]Is (34059,130)it (34189,120)");
      expect(tags.metadata).toEqual({});
      expect(tags.offsetSeconds).toBe(0);
    });

    it("shares no state between calls", () => {
      const first = parseHeaderTags("[ti:One]");
      const second = parseHeaderTags("[ar:Two]");
      expect(first.metadata.artists).toBeUndefined();
      expect(second.metadata.title).toBeUndefined();
    });
  });

  describe("error paths", () => {
    it("returns empty metadata for an empty document", () => {
      const tags = parseHeaderTags("");
      expect(tags.metadata).toEqual({});
      expect(tags.offsetSeconds).toBe(0);
    });

    it("ignores an unterminated tag", () => {
      expect(parseHeaderTags("[ti:Wanderlust").metadata).toEqual({});
    });
  });
});
