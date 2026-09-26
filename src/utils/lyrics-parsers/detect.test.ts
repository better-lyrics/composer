import { describe, expect, it } from "vitest";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { detectFileType } from "@/utils/lyrics-parsers/detect";

// -- Constants ----------------------------------------------------------------

const LRC_BODY = "[00:12.34]Hello world";
const SRT_BODY = "1\n00:00:01,000 --> 00:00:02,000\nHello world";
const TTML_BODY = '<tt xmlns="http://www.w3.org/ns/ttml"></tt>';
const TTML_BODY_WITH_QRC_BRACKET =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="1s" end="2s">Meet me at [1000,500] tonight</p></div></body></tt>';
const QRC_BODY = "[34059,2299]Is (34059,130)it (34189,120)";
const SRT_BODY_WITH_QRC_BRACKET = "1\n00:00:01,000 --> 00:00:02,000\nMeet me at [1000,500] tonight";
const PLAIN_BODY = "Is it so hard to say the same thing";

// -- Tests --------------------------------------------------------------------

describe("detectFileType", () => {
  describe("by extension", () => {
    it("reads txt, lrc and srt straight off the extension", () => {
      expect(detectFileType("song.txt", PLAIN_BODY)).toBe("txt");
      expect(detectFileType("song.lrc", LRC_BODY)).toBe("lrc");
      expect(detectFileType("song.srt", SRT_BODY)).toBe("srt");
    });

    it("reads ttml from a .ttml file carrying TTML content", () => {
      expect(detectFileType("song.ttml", TTML_BODY)).toBe("ttml");
    });

    it("ignores the case of the extension", () => {
      expect(detectFileType("SONG.LRC", LRC_BODY)).toBe("lrc");
      expect(detectFileType("SONG.QRC", WANDERLUST_QRC)).toBe("qrc");
    });

    it("reads the last extension of a multi-dot filename", () => {
      expect(detectFileType("my.song.v2.qrc", WANDERLUST_QRC)).toBe("qrc");
    });
  });

  describe("qrc", () => {
    it("detects a .qrc extension", () => {
      expect(detectFileType("lyrics.qrc", WANDERLUST_QRC)).toBe("qrc");
    });

    it("trusts the .qrc extension on a body the content sniffer would read as plain text", () => {
      expect(detectFileType("lyrics.qrc", PLAIN_BODY)).toBe("qrc");
      expect(detectFileType("lyrics.qrc", "")).toBe("qrc");
    });

    it("detects QRC inside a .xml file by its QrcInfos root", () => {
      expect(detectFileType("lyrics.xml", WANDERLUST_QRC)).toBe("qrc");
    });

    it("detects a bare QRC body by its bracketed millisecond header", () => {
      expect(detectFileType("pasted", QRC_BODY)).toBe("qrc");
    });

    it("prefers a QrcInfos root over an element that merely starts with tt", () => {
      const document = '<QrcInfos><LyricInfo LyricContent="[1000,500]Hi (1000,500)"/><ttInfo/></QrcInfos>';
      expect(detectFileType("lyrics.xml", document)).toBe("qrc");
    });

    it("does not mistake LRC for QRC", () => {
      expect(detectFileType("song.lrc", LRC_BODY)).toBe("lrc");
      expect(detectFileType("pasted", LRC_BODY)).toBe("lrc");
    });

    it("does not mistake TTML for QRC", () => {
      expect(detectFileType("song.xml", TTML_BODY)).toBe("ttml");
      expect(detectFileType("pasted", TTML_BODY)).toBe("ttml");
    });

    it("reads TTML carrying a bracketed millisecond pair in its lyrics as TTML", () => {
      expect(detectFileType("pasted", TTML_BODY_WITH_QRC_BRACKET)).toBe("ttml");
      expect(detectFileType("song.xml", TTML_BODY_WITH_QRC_BRACKET)).toBe("ttml");
      expect(detectFileType("song.ttml", TTML_BODY_WITH_QRC_BRACKET)).toBe("ttml");
    });

    it("reads a bare SRT body as SRT", () => {
      expect(detectFileType("pasted", SRT_BODY)).toBe("srt");
    });

    it("reads an extension-less SRT body as SRT even when its text carries a bracketed pair", () => {
      expect(detectFileType("pasted", SRT_BODY_WITH_QRC_BRACKET)).toBe("srt");
      expect(detectFileType("subtitles.srt", SRT_BODY_WITH_QRC_BRACKET)).toBe("srt");
    });

    it("still reads an extension-less QRC body as QRC, since QRC cannot open like a cue", () => {
      expect(detectFileType("pasted", QRC_BODY)).toBe("qrc");
    });
  });

  describe("edge cases", () => {
    it("treats a known extension as authoritative over the content it holds", () => {
      expect(detectFileType("notes.txt", QRC_BODY)).toBe("txt");
      expect(detectFileType("notes.txt", LRC_BODY)).toBe("txt");
    });

    it("falls back to the content when a .xml file is neither TTML nor QRC", () => {
      expect(detectFileType("song.xml", LRC_BODY)).toBe("lrc");
      expect(detectFileType("song.xml", QRC_BODY)).toBe("qrc");
    });

    it("falls back to txt for a filename with no extension and unrecognisable content", () => {
      expect(detectFileType("pasted", PLAIN_BODY)).toBe("txt");
    });

    it("returns txt for an empty document and an empty filename", () => {
      expect(detectFileType("", "")).toBe("txt");
      expect(detectFileType("lyrics", "")).toBe("txt");
    });
  });

  describe("invariants", () => {
    it("returns the same type for the same input every time", () => {
      const inputs: [string, string][] = [
        ["lyrics.qrc", WANDERLUST_QRC],
        ["pasted", QRC_BODY],
        ["song.lrc", LRC_BODY],
        ["song.xml", TTML_BODY],
      ];
      for (const [filename, content] of inputs) {
        expect(detectFileType(filename, content)).toBe(detectFileType(filename, content));
      }
    });

    it("never reports unknown, since every document falls back to txt", () => {
      const contents = ["", PLAIN_BODY, QRC_BODY, LRC_BODY, SRT_BODY, TTML_BODY, WANDERLUST_QRC];
      for (const content of contents) {
        expect(detectFileType("pasted", content)).not.toBe("unknown");
      }
    });
  });

  describe("error paths", () => {
    it("does not throw on control characters and stray brackets", () => {
      expect(() => detectFileType("mystery.bin", "\u0000\u0001 [,] ")).not.toThrow();
    });

    it("does not throw on a truncated QRC document", () => {
      expect(() => detectFileType("lyrics.qrc", "<QrcInfos><LyricInfo LyricContent=")).not.toThrow();
    });
  });
});
