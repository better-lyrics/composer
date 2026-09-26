import { describe, expect, it } from "vitest";
import {
  ALIAS_LYRICS_EXTENSIONS,
  isSupportedLyricsFile,
  LYRICS_FILE_ACCEPT_ATTRIBUTE,
  LYRICS_FORMATS_COMPACT,
  LYRICS_FORMATS_DESCRIBED,
  LYRICS_FORMATS_PROSE,
  SUPPORTED_LYRICS_FORMATS,
  UNSUPPORTED_LYRICS_FILE_MESSAGE,
} from "@/domain/lyrics-file/supported-formats";
import { PARSERS } from "@/utils/lyrics-parsers";
import { detectFileType } from "@/utils/lyrics-parsers/detect";

// -- Declaration ---------------------------------------------------------------

describe("SUPPORTED_LYRICS_FORMATS", () => {
  it("declares every format the app can import", () => {
    expect(SUPPORTED_LYRICS_FORMATS.map((f) => f.extension)).toEqual(["txt", "lrc", "srt", "ttml", "qrc"]);
  });

  it("declares .qrc with a description of QQ Music word timing", () => {
    const qrc = SUPPORTED_LYRICS_FORMATS.find((f) => f.extension === "qrc");
    expect(qrc).toBeDefined();
    expect(qrc?.label).toBe(".qrc");
    expect(qrc?.description).toBe("QQ Music word timing");
  });

  it("treats .xml as an alias extension rather than a format of its own", () => {
    expect(ALIAS_LYRICS_EXTENSIONS).toEqual(["xml"]);
    const declared = new Set<string>(SUPPORTED_LYRICS_FORMATS.map((f) => f.extension));
    for (const alias of ALIAS_LYRICS_EXTENSIONS) expect(declared.has(alias)).toBe(false);
  });
});

// -- Derived strings -----------------------------------------------------------

describe("derived strings", () => {
  it("builds the file input accept attribute from every accepted extension", () => {
    expect(LYRICS_FILE_ACCEPT_ATTRIBUTE).toBe(".txt,.lrc,.srt,.ttml,.qrc,.xml");
  });

  it("builds the space separated display string from the advertised formats", () => {
    expect(LYRICS_FORMATS_COMPACT).toBe(".txt .lrc .srt .ttml .qrc");
  });

  it("builds the comma separated prose string from the advertised formats", () => {
    expect(LYRICS_FORMATS_PROSE).toBe(".txt, .lrc, .srt, .ttml, .qrc");
  });

  it("builds the described prose string with one parenthesised description per format", () => {
    expect(LYRICS_FORMATS_DESCRIBED).toBe(
      ".txt (plain text), .lrc (line-level timing), .srt (subtitles), .ttml (full timing + agents), .qrc (QQ Music word timing)",
    );
  });

  it("builds the unsupported type message from the advertised formats", () => {
    expect(UNSUPPORTED_LYRICS_FILE_MESSAGE).toBe("Unsupported file type. Use .txt .lrc .srt .ttml .qrc");
  });
});

// -- Predicate -----------------------------------------------------------------

describe("isSupportedLyricsFile", () => {
  it("accepts a file for every declared format", () => {
    for (const format of SUPPORTED_LYRICS_FORMATS) {
      expect(isSupportedLyricsFile(`song${format.label}`)).toBe(true);
    }
  });

  it("accepts a QRC document served under an alias extension", () => {
    expect(isSupportedLyricsFile("wanderlust.xml")).toBe(true);
  });

  it("rejects a file type the app cannot parse", () => {
    expect(isSupportedLyricsFile("cover.png")).toBe(false);
    expect(isSupportedLyricsFile("track.mp3")).toBe(false);
    expect(isSupportedLyricsFile("project.json")).toBe(false);
  });
});

describe("edge cases", () => {
  it("ignores extension case", () => {
    expect(isSupportedLyricsFile("SONG.QRC")).toBe(true);
    expect(isSupportedLyricsFile("Song.TtMl")).toBe(true);
    expect(isSupportedLyricsFile("SONG.PNG")).toBe(false);
  });

  it("reads only the final extension of a double extension", () => {
    expect(isSupportedLyricsFile("song.ttml.txt")).toBe(true);
    expect(isSupportedLyricsFile("song.txt.png")).toBe(false);
    expect(isSupportedLyricsFile("song.png.qrc")).toBe(true);
  });

  it("accepts a filename that is nothing but an extension", () => {
    expect(isSupportedLyricsFile(".qrc")).toBe(true);
    expect(isSupportedLyricsFile(".png")).toBe(false);
  });

  it("rejects a filename with no extension", () => {
    expect(isSupportedLyricsFile("song")).toBe(false);
    expect(isSupportedLyricsFile("lyrics-qrc")).toBe(false);
  });

  it("rejects an empty filename", () => {
    expect(isSupportedLyricsFile("")).toBe(false);
  });

  it("rejects a filename ending in a bare dot", () => {
    expect(isSupportedLyricsFile("song.")).toBe(false);
  });

  it("does not match an extension that merely contains a supported one", () => {
    expect(isSupportedLyricsFile("song.txts")).toBe(false);
    expect(isSupportedLyricsFile("song.qrcx")).toBe(false);
  });

  it("handles a path-like name with dots in the directory portion", () => {
    expect(isSupportedLyricsFile("my.songs/wanderlust.qrc")).toBe(true);
    expect(isSupportedLyricsFile("my.qrc/cover.png")).toBe(false);
  });

  it("handles unicode and whitespace in the stem", () => {
    expect(isSupportedLyricsFile("周杰倫 - 稻香.qrc")).toBe(true);
    expect(isSupportedLyricsFile("  spaced out .lrc")).toBe(true);
  });
});

// -- Invariants ----------------------------------------------------------------

describe("invariants", () => {
  it("gives every declared format a label that is its extension with a leading dot", () => {
    for (const format of SUPPORTED_LYRICS_FORMATS) {
      expect(format.label).toBe(`.${format.extension}`);
    }
  });

  it("declares no duplicate extensions across formats and aliases", () => {
    const all = [...SUPPORTED_LYRICS_FORMATS.map((f) => f.extension), ...ALIAS_LYRICS_EXTENSIONS];
    expect(new Set(all).size).toBe(all.length);
  });

  it("accepts every declared format and alias through the predicate", () => {
    for (const format of SUPPORTED_LYRICS_FORMATS) expect(isSupportedLyricsFile(`x.${format.extension}`)).toBe(true);
    for (const alias of ALIAS_LYRICS_EXTENSIONS) expect(isSupportedLyricsFile(`x.${alias}`)).toBe(true);
  });

  it("lists every declared format and alias in the accept attribute", () => {
    const accepted = LYRICS_FILE_ACCEPT_ATTRIBUTE.split(",");
    for (const format of SUPPORTED_LYRICS_FORMATS) expect(accepted).toContain(format.label);
    for (const alias of ALIAS_LYRICS_EXTENSIONS) expect(accepted).toContain(`.${alias}`);
    expect(new Set(accepted).size).toBe(accepted.length);
  });

  it("advertises every declared format in every user-facing copy string", () => {
    for (const format of SUPPORTED_LYRICS_FORMATS) {
      expect(LYRICS_FORMATS_COMPACT).toContain(format.label);
      expect(LYRICS_FORMATS_PROSE).toContain(format.label);
      expect(LYRICS_FORMATS_DESCRIBED).toContain(`${format.label} (${format.description})`);
      expect(UNSUPPORTED_LYRICS_FILE_MESSAGE).toContain(format.label);
    }
  });

  it("never advertises an alias extension in user-facing copy", () => {
    for (const alias of ALIAS_LYRICS_EXTENSIONS) {
      expect(LYRICS_FORMATS_COMPACT).not.toContain(alias);
      expect(LYRICS_FORMATS_PROSE).not.toContain(alias);
      expect(LYRICS_FORMATS_DESCRIBED).not.toContain(alias);
      expect(UNSUPPORTED_LYRICS_FILE_MESSAGE).not.toContain(alias);
    }
  });

  it("has a registered parser for every declared format", () => {
    for (const format of SUPPORTED_LYRICS_FORMATS) {
      expect(typeof PARSERS[format.extension]).toBe("function");
    }
  });

  it("resolves the .xml alias by content rather than by extension", () => {
    expect(detectFileType("song.xml", "<QrcInfos>")).toBe("qrc");
    expect(detectFileType("song.xml", '<tt xmlns="http://www.w3.org/ns/ttml">')).toBe("ttml");
  });

  it("gives every format a non-empty description written in the house sentence-free tone", () => {
    for (const format of SUPPORTED_LYRICS_FORMATS) {
      expect(format.description.length).toBeGreaterThan(0);
      expect(format.description).not.toMatch(/[.!]$/);
    }
  });

  it("keeps every copy string free of em dashes and en dashes", () => {
    const copy = [
      LYRICS_FORMATS_COMPACT,
      LYRICS_FORMATS_PROSE,
      LYRICS_FORMATS_DESCRIBED,
      UNSUPPORTED_LYRICS_FILE_MESSAGE,
    ].join(" ");
    expect(copy).not.toMatch(/[–—]/);
  });
});
