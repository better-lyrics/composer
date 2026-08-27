import { describe, expect, it } from "vitest";
import {
  matchAllLineHeaders,
  matchAllWordTags,
  QRC_LINE_HEADER_REGEX,
  QRC_WORD_TAG_REGEX,
  stripWordTags,
} from "@/domain/lyrics-file/qrc-syntax";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";

// The SICKO MODE title line from QQ Music: its lyric text carries literal parentheses next to word tags.
const SICKO_MODE_TITLE_LINE =
  "[0,1730]SICKO(0,240) (240,48)MODE(288,192) (480,48)((528,48)Explicit(576,385))(961,48) (1009,48)-(1057,48) (1105,48)Travis(1153,288) (1441,48)Scott(1489,241)";

const WANDERLUST_LINE_COUNT = 90;

// -- QRC_LINE_HEADER_REGEX ----------------------------------------------------

describe("QRC_LINE_HEADER_REGEX", () => {
  it("detects a line header in a real QRC document", () => {
    expect(QRC_LINE_HEADER_REGEX.test(WANDERLUST_QRC)).toBe(true);
  });

  it("captures the begin and duration milliseconds", () => {
    expect("[34059,2299]Is it so hard".match(QRC_LINE_HEADER_REGEX)?.slice(0, 3)).toEqual([
      "[34059,2299]",
      "34059",
      "2299",
    ]);
  });

  it("matches a header that begins at zero", () => {
    expect(SICKO_MODE_TITLE_LINE.match(QRC_LINE_HEADER_REGEX)?.slice(0, 3)).toEqual(["[0,1730]", "0", "1730"]);
  });

  it("rejects an LRC line timestamp", () => {
    expect(QRC_LINE_HEADER_REGEX.test("[00:12.34]Hello world")).toBe(false);
    expect(QRC_LINE_HEADER_REGEX.test("[00:12,34]Hello world")).toBe(false);
  });

  it("rejects a QRC header tag", () => {
    for (const tag of ["[ti:Wanderlust]", "[ar:The Weeknd]", "[al:Kiss Land]", "[by:]", "[offset:0]"]) {
      expect(QRC_LINE_HEADER_REGEX.test(tag)).toBe(false);
    }
  });

  it("rejects a header with a missing or non-numeric field", () => {
    for (const header of ["[1000,]", "[,500]", "[]", "[abc,def]", "[1000]"]) {
      expect(QRC_LINE_HEADER_REGEX.test(header)).toBe(false);
    }
  });

  it("rejects a header padded with spaces around the comma", () => {
    expect(QRC_LINE_HEADER_REGEX.test("[1000 , 500]")).toBe(false);
  });

  it("rejects a negative begin", () => {
    expect(QRC_LINE_HEADER_REGEX.test("[-1000,500]")).toBe(false);
  });
});

// -- QRC_WORD_TAG_REGEX -------------------------------------------------------

describe("QRC_WORD_TAG_REGEX", () => {
  it("detects a word tag in a real QRC document", () => {
    expect(QRC_WORD_TAG_REGEX.test(WANDERLUST_QRC)).toBe(true);
  });

  it("captures the begin and duration milliseconds", () => {
    expect("Wanderlust - (5767,109)The".match(QRC_WORD_TAG_REGEX)?.slice(0, 3)).toEqual(["(5767,109)", "5767", "109"]);
  });

  it("matches a tag that begins at zero", () => {
    expect("SICKO(0,240)".match(QRC_WORD_TAG_REGEX)?.slice(0, 3)).toEqual(["(0,240)", "0", "240"]);
  });

  it("rejects a tag with a missing or non-numeric field", () => {
    for (const tag of ["(5767)", "(5767,)", "(,109)", "()", "(abc,def)"]) {
      expect(QRC_WORD_TAG_REGEX.test(tag)).toBe(false);
    }
  });

  it("rejects a tag padded with spaces around the comma", () => {
    expect(QRC_WORD_TAG_REGEX.test("(5767 , 109)")).toBe(false);
  });

  it("does not read a line header as a word tag", () => {
    expect(QRC_WORD_TAG_REGEX.test("[34059,2299]Is it so hard")).toBe(false);
  });

  it("does not read a word tag as a line header", () => {
    expect(QRC_LINE_HEADER_REGEX.test("Wanderlust - (5767,109)The")).toBe(false);
  });
});

// -- matchAllLineHeaders -------------------------------------------------------

describe("matchAllLineHeaders", () => {
  it("finds every line header in a real QRC document", () => {
    const matches = matchAllLineHeaders(WANDERLUST_QRC);
    expect(matches).toHaveLength(WANDERLUST_LINE_COUNT);
    expect(matches[0].slice(0, 3)).toEqual(["[5767,324]", "5767", "324"]);
    expect(matches.at(-1)?.slice(0, 3)).toEqual(["[297346,1826]", "297346", "1826"]);
  });

  it("reports the offset of each header, which the parser slices line bodies from", () => {
    const matches = matchAllLineHeaders("[1000,500]Hi\n[2000,500]There");
    expect(matches.map((match) => match.index)).toEqual([0, 13]);
  });
});

// -- matchAllWordTags ----------------------------------------------------------

describe("matchAllWordTags", () => {
  it("finds every word tag on a real lyric line", () => {
    const line = "[34059,2299]Is (34059,130)it (34189,120)so (34309,104)hard (34413,281)";
    expect(matchAllWordTags(line).map((match) => match[0])).toEqual([
      "(34059,130)",
      "(34189,120)",
      "(34309,104)",
      "(34413,281)",
    ]);
  });

  it("counts a tag that opens right after a literal parenthesis exactly once", () => {
    const tags = matchAllWordTags(SICKO_MODE_TITLE_LINE).map((match) => match[0]);
    expect(tags).toHaveLength(13);
    expect(tags).toContain("(528,48)");
    expect(tags).toContain("(961,48)");
  });
});

// -- stripWordTags -------------------------------------------------------------

describe("stripWordTags", () => {
  it("strips tags while leaving literal parentheses in the lyric text", () => {
    const body = SICKO_MODE_TITLE_LINE.replace(QRC_LINE_HEADER_REGEX, "");
    expect(stripWordTags(body)).toBe("SICKO MODE (Explicit) - Travis Scott");
  });

  it("leaves text that carries no tags untouched", () => {
    expect(stripWordTags("Is it so hard")).toBe("Is it so hard");
  });
});

// -- Invariants ---------------------------------------------------------------

describe("invariants", () => {
  it("keeps the detection regexes non-global, since test() on a /g regex is stateful", () => {
    expect(QRC_LINE_HEADER_REGEX.global).toBe(false);
    expect(QRC_WORD_TAG_REGEX.global).toBe(false);
  });

  it("finds the same headers on a repeated call, so no scan state leaks between calls", () => {
    const first = matchAllLineHeaders(WANDERLUST_QRC);
    expect(matchAllLineHeaders(WANDERLUST_QRC)).toHaveLength(first.length);
  });

  it("strips the same tags on a repeated call, so no scan state leaks between calls", () => {
    const first = stripWordTags(WANDERLUST_QRC);
    expect(stripWordTags(WANDERLUST_QRC)).toBe(first);
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("edge cases", () => {
  it("finds nothing in an empty or whitespace-only document", () => {
    for (const document of ["", "   \r\n\t  \n"]) {
      expect(QRC_LINE_HEADER_REGEX.test(document)).toBe(false);
      expect(QRC_WORD_TAG_REGEX.test(document)).toBe(false);
      expect(matchAllLineHeaders(document)).toEqual([]);
      expect(matchAllWordTags(document)).toEqual([]);
    }
  });

  it("finds nothing in an unsynced QRC body that is plain text", () => {
    const plain = "What's the use?\r\nI followed\r\nAll the rules";
    expect(QRC_LINE_HEADER_REGEX.test(plain)).toBe(false);
    expect(QRC_WORD_TAG_REGEX.test(plain)).toBe(false);
  });

  it("matches a zero-duration tag, which QQ emits when two words share an onset", () => {
    expect("all (208907,0)about".match(QRC_WORD_TAG_REGEX)?.slice(0, 3)).toEqual(["(208907,0)", "208907", "0"]);
  });

  it("matches millisecond values past the length of any real song", () => {
    expect("[999999999,1]x".match(QRC_LINE_HEADER_REGEX)?.slice(0, 3)).toEqual(["[999999999,1]", "999999999", "1"]);
  });

  it("matches a header that carries no lyric text after it", () => {
    expect(QRC_LINE_HEADER_REGEX.test("[49296,189]")).toBe(true);
  });

  it("does not read TTML timing as QRC timing", () => {
    const xml = '<tt><body><div><p begin="00:01.000" end="00:02.000">x</p></div></body></tt>';
    expect(QRC_LINE_HEADER_REGEX.test(xml)).toBe(false);
    expect(QRC_WORD_TAG_REGEX.test(xml)).toBe(false);
  });

  it("finds the header inside the XML envelope QQ wraps the body in", () => {
    const document = '<QrcInfos><LyricInfo LyricContent="[1000,500]Hi (1000,500)"/></QrcInfos>';
    expect(matchAllLineHeaders(document).map((match) => match[0])).toEqual(["[1000,500]"]);
    expect(matchAllWordTags(document).map((match) => match[0])).toEqual(["(1000,500)"]);
  });
});

// -- Error paths --------------------------------------------------------------

describe("error paths", () => {
  it("finds nothing in a truncated header", () => {
    for (const truncated of ["[1000,", "[1000,500", "1000,500]"]) {
      expect(QRC_LINE_HEADER_REGEX.test(truncated)).toBe(false);
    }
  });

  it("finds nothing in a truncated tag", () => {
    for (const truncated of ["(1000,", "(1000,500", "1000,500)"]) {
      expect(QRC_WORD_TAG_REGEX.test(truncated)).toBe(false);
    }
  });

  it("recovers the intact headers from a document truncated mid-line", () => {
    const truncated = '<QrcInfos><LyricInfo LyricContent="[1000,500]Hi (1000,500)\n[2000,';
    expect(matchAllLineHeaders(truncated).map((match) => match[0])).toEqual(["[1000,500]"]);
  });

  it("does not match across a bracket that closes on a later line", () => {
    expect(QRC_LINE_HEADER_REGEX.test("[1000,\n500]")).toBe(false);
  });
});
