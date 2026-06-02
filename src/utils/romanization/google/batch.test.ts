import { describe, expect, it } from "vitest";
import { encodeBatch, LINE_SEP, parseBatchResponse, WORD_SEP } from "@/utils/romanization/google/batch";

const W = "␞";
const L = "␝";

describe("WORD_SEP / LINE_SEP constants", () => {
  it("WORD_SEP is U+241E (SYMBOL FOR RECORD SEPARATOR)", () => {
    expect(WORD_SEP).toBe("␞");
    expect(WORD_SEP).toBe(W);
  });
  it("LINE_SEP is U+241D (SYMBOL FOR GROUP SEPARATOR)", () => {
    expect(LINE_SEP).toBe("␝");
    expect(LINE_SEP).toBe(L);
  });
});

describe("encodeBatch", () => {
  it("joins words inside a line with WORD_SEP", () => {
    expect(encodeBatch([["a", "b", "c"]])).toBe(`a${W}b${W}c`);
  });

  it("joins lines with paragraph-wrapped LINE_SEP", () => {
    expect(encodeBatch([["a"], ["b"]])).toBe(`a\n\n${L}\n\nb`);
  });

  it("encodes a realistic two-line Korean batch", () => {
    const out = encodeBatch([
      ["사", "랑", "해"],
      ["너", "를"],
    ]);
    expect(out).toBe(`사${W}랑${W}해\n\n${L}\n\n너${W}를`);
  });

  it("returns empty string for empty input", () => {
    expect(encodeBatch([])).toBe("");
  });

  it("returns the empty string for an empty line (zero words)", () => {
    expect(encodeBatch([[]])).toBe("");
  });

  it("handles a single-word single-line case", () => {
    expect(encodeBatch([["yo"]])).toBe("yo");
  });

  it("does not strip empty-string words in the middle of a line (they round-trip)", () => {
    expect(encodeBatch([["a", "", "c"]])).toBe(`a${W}${W}c`);
  });
});

describe("parseBatchResponse: happy path", () => {
  it("splits a clean response on LINE_SEP, then WORD_SEP", () => {
    const romaji = `sa${W}lang${W}hae\n\n${L}\n\nneo${W}leul`;
    expect(parseBatchResponse(romaji, [3, 2])).toEqual([
      ["sa", "lang", "hae"],
      ["neo", "leul"],
    ]);
  });

  it("returns null per line whose word count does not match the expected count", () => {
    const romaji = `sa${W}lang\n\n${L}\n\nneo${W}leul`;
    expect(parseBatchResponse(romaji, [3, 2])).toEqual([null, ["neo", "leul"]]);
  });

  it("returns the full array as one line when no expected counts are provided", () => {
    const romaji = `sa${W}lang${W}hae\n\n${L}\n\nneo${W}leul`;
    expect(parseBatchResponse(romaji)).toEqual([
      ["sa", "lang", "hae"],
      ["neo", "leul"],
    ]);
  });

  it("trims whitespace around the line and word slices (defensive)", () => {
    const romaji = `  sa ${W} lang ${W} hae  \n\n${L}\n\n neo ${W} leul `;
    expect(parseBatchResponse(romaji, [3, 2])).toEqual([
      ["sa", "lang", "hae"],
      ["neo", "leul"],
    ]);
  });
});

describe("parseBatchResponse: delimiter collapse recovery", () => {
  it("falls back to bare LINE_SEP when newlines were stripped", () => {
    const romaji = `sa${W}lang${W}hae${L}neo${W}leul`;
    expect(parseBatchResponse(romaji, [3, 2])).toEqual([
      ["sa", "lang", "hae"],
      ["neo", "leul"],
    ]);
  });

  it("falls back to better-lyrics' '\\n\\n;\\n\\n' separator if Google reformats", () => {
    const romaji = `sa${W}lang${W}hae\n\n;\n\nneo${W}leul`;
    expect(parseBatchResponse(romaji, [3, 2])).toEqual([
      ["sa", "lang", "hae"],
      ["neo", "leul"],
    ]);
  });

  it("falls back to bare ';' separator if newlines and decoration both gone", () => {
    const romaji = `sa${W}lang${W}hae;neo${W}leul`;
    expect(parseBatchResponse(romaji, [3, 2])).toEqual([
      ["sa", "lang", "hae"],
      ["neo", "leul"],
    ]);
  });

  it("falls back to bare '\\n\\n' paragraph boundary as the last resort", () => {
    const romaji = `sa${W}lang${W}hae\n\nneo${W}leul`;
    expect(parseBatchResponse(romaji, [3, 2])).toEqual([
      ["sa", "lang", "hae"],
      ["neo", "leul"],
    ]);
  });

  it("returns a single-line array when no delimiter is found at all", () => {
    const romaji = `sa${W}lang${W}hae`;
    expect(parseBatchResponse(romaji, [3])).toEqual([["sa", "lang", "hae"]]);
  });

  it("returns [null] for a single line whose word count is wrong and no delimiter is found", () => {
    const romaji = `sa${W}lang`;
    expect(parseBatchResponse(romaji, [3])).toEqual([null]);
  });
});

describe("parseBatchResponse: edge cases", () => {
  it("returns empty array for empty input", () => {
    expect(parseBatchResponse("")).toEqual([]);
  });

  it("treats an empty input as a single empty result when expectedWordCounts has one zero-count entry", () => {
    expect(parseBatchResponse("", [0])).toEqual([[]]);
  });

  it("expectedWordCounts longer than parsed line count: pad with nulls", () => {
    const romaji = `sa${W}lang`;
    expect(parseBatchResponse(romaji, [2, 3])).toEqual([["sa", "lang"], null]);
  });

  it("expectedWordCounts shorter than parsed line count: extra lines become trailing nulls", () => {
    const romaji = `a\n\n${L}\n\nb\n\n${L}\n\nc`;
    expect(parseBatchResponse(romaji, [1])).toEqual([["a"]]);
  });
});

describe("parseBatchResponse: encode/decode round-trip", () => {
  it("round-trips clean Korean", () => {
    const lines = [
      ["사", "랑", "해"],
      ["너", "를"],
    ];
    const encoded = encodeBatch(lines);
    const decoded = parseBatchResponse(
      encoded,
      lines.map((l) => l.length),
    );
    expect(decoded).toEqual(lines);
  });
});
