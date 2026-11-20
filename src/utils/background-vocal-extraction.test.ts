import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { createLine } from "@/test/factories";
import {
  classifyLine,
  extractBackgroundVocals,
  extractInlineFromLine,
  lineHasInlineParens,
  scanParenGroups,
} from "@/utils/background-vocal-extraction";

// -- Specification table -------------------------------------------------------

describe("scanParenGroups: specification table", () => {
  it("returns balanced with no groups for plain text", () => {
    const scan = scanParenGroups("Hello world");
    expect(scan.status).toBe("balanced");
    expect(scan.groups).toEqual([]);
  });

  it("returns one group for a single balanced pair", () => {
    const text = "Hello (ooh) world";
    const scan = scanParenGroups(text);
    expect(scan.status).toBe("balanced");
    expect(scan.groups).toHaveLength(1);
    expect(scan.groups[0].inner).toBe("ooh");
    expect(scan.groups[0].start).toBe(text.indexOf("("));
    expect(scan.groups[0].end).toBe(text.indexOf(")"));
  });

  it("returns two groups for two balanced pairs", () => {
    const scan = scanParenGroups("Hi (a) and (b)");
    expect(scan.status).toBe("balanced");
    expect(scan.groups).toHaveLength(2);
    expect(scan.groups[0].inner).toBe("a");
    expect(scan.groups[1].inner).toBe("b");
  });

  it("returns unbalanced for an unclosed open paren", () => {
    const scan = scanParenGroups("Hello (ooh");
    expect(scan.status).toBe("unbalanced");
    expect(scan.groups).toEqual([]);
  });

  it("returns unbalanced for a stray close paren", () => {
    const scan = scanParenGroups("yeah)");
    expect(scan.status).toBe("unbalanced");
    expect(scan.groups).toEqual([]);
  });

  it("returns unbalanced when depth goes negative before recovering", () => {
    const scan = scanParenGroups("Hello )ooh(");
    expect(scan.status).toBe("unbalanced");
    expect(scan.groups).toEqual([]);
  });

  it("returns nested for back-to-back opens", () => {
    const scan = scanParenGroups("((ooh))");
    expect(scan.status).toBe("nested");
    expect(scan.groups).toEqual([]);
  });

  it("returns nested for an open paren inside an open group", () => {
    const scan = scanParenGroups("(ooh (ah))");
    expect(scan.status).toBe("nested");
    expect(scan.groups).toEqual([]);
  });

  it("returns balanced with no groups for an empty string", () => {
    const scan = scanParenGroups("");
    expect(scan.status).toBe("balanced");
    expect(scan.groups).toEqual([]);
  });
});

// -- Inner content edge cases --------------------------------------------------

describe("scanParenGroups: inner content", () => {
  it("treats an empty pair as a balanced group with empty inner", () => {
    const scan = scanParenGroups("()");
    expect(scan.status).toBe("balanced");
    expect(scan.groups).toHaveLength(1);
    expect(scan.groups[0].inner).toBe("");
  });

  it("returns raw inner without trimming surrounding spaces", () => {
    const scan = scanParenGroups("( a b )");
    expect(scan.status).toBe("balanced");
    expect(scan.groups).toHaveLength(1);
    expect(scan.groups[0].inner).toBe(" a b ");
  });

  it("preserves inner whitespace exactly for a multi-word group", () => {
    const scan = scanParenGroups("la (ooh ah  yeah) la");
    expect(scan.status).toBe("balanced");
    expect(scan.groups[0].inner).toBe("ooh ah  yeah");
  });
});

// -- Group positioning ---------------------------------------------------------

describe("scanParenGroups: group positioning", () => {
  it("handles adjacent groups with no separator", () => {
    const text = "(a)(b)";
    const scan = scanParenGroups(text);
    expect(scan.status).toBe("balanced");
    expect(scan.groups).toHaveLength(2);
    expect(scan.groups[0].inner).toBe("a");
    expect(scan.groups[1].inner).toBe("b");
  });

  it("handles a group at the start of the string", () => {
    const text = "(a) b";
    const scan = scanParenGroups(text);
    expect(scan.status).toBe("balanced");
    expect(scan.groups).toHaveLength(1);
    expect(scan.groups[0].start).toBe(0);
    expect(scan.groups[0].end).toBe(2);
    expect(scan.groups[0].inner).toBe("a");
  });

  it("handles a group at the end of the string", () => {
    const text = "a (b)";
    const scan = scanParenGroups(text);
    expect(scan.status).toBe("balanced");
    expect(scan.groups).toHaveLength(1);
    expect(scan.groups[0].start).toBe(text.length - 3);
    expect(scan.groups[0].end).toBe(text.length - 1);
    expect(scan.groups[0].inner).toBe("b");
  });

  it("reports start at '(' and end at ')' for every group", () => {
    const text = "Hi (a) and (b)";
    const scan = scanParenGroups(text);
    expect(scan.status).toBe("balanced");
    for (const group of scan.groups) {
      expect(text[group.start]).toBe("(");
      expect(text[group.end]).toBe(")");
      expect(text.slice(group.start + 1, group.end)).toBe(group.inner);
    }
  });

  it("reports correct indices for adjacent groups", () => {
    const scan = scanParenGroups("(a)(b)");
    expect(scan.groups[0].start).toBe(0);
    expect(scan.groups[0].end).toBe(2);
    expect(scan.groups[1].start).toBe(3);
    expect(scan.groups[1].end).toBe(5);
  });
});

// -- Unbalanced edge cases -----------------------------------------------------

describe("scanParenGroups: unbalanced edge cases", () => {
  it("returns unbalanced for a lone close paren", () => {
    const scan = scanParenGroups(")");
    expect(scan.status).toBe("unbalanced");
    expect(scan.groups).toEqual([]);
  });

  it("returns unbalanced for a lone open paren", () => {
    const scan = scanParenGroups("(");
    expect(scan.status).toBe("unbalanced");
    expect(scan.groups).toEqual([]);
  });

  it("returns unbalanced when a close paren precedes a balanced pair", () => {
    const scan = scanParenGroups(")(a)");
    expect(scan.status).toBe("unbalanced");
    expect(scan.groups).toEqual([]);
  });

  it("returns unbalanced when an extra open paren trails balanced groups", () => {
    const scan = scanParenGroups("(a) (b) (");
    expect(scan.status).toBe("unbalanced");
    expect(scan.groups).toEqual([]);
  });
});

// -- classifyLine: specification table -----------------------------------------

describe("classifyLine: specification table", () => {
  it("classifies plain text as none", () => {
    const result = classifyLine("Hello world");
    expect(result.kind).toBe("none");
    expect(result.mainText).toBe("Hello world");
    expect(result.bgText).toBe("");
  });

  it("classifies a mid-line group as inline", () => {
    const result = classifyLine("Hello (ooh) world");
    expect(result.kind).toBe("inline");
    expect(result.mainText).toBe("Hello world");
    expect(result.bgText).toBe("ooh");
  });

  it("classifies a trailing group as inline", () => {
    const result = classifyLine("Hello (ooh)");
    expect(result.kind).toBe("inline");
    expect(result.mainText).toBe("Hello");
    expect(result.bgText).toBe("ooh");
  });

  it("classifies a leading group as inline", () => {
    const result = classifyLine("(ooh) world");
    expect(result.kind).toBe("inline");
    expect(result.mainText).toBe("world");
    expect(result.bgText).toBe("ooh");
  });

  it("classifies multiple inline groups, joining bg text with a space", () => {
    const result = classifyLine("Hi (a) and (b) bye");
    expect(result.kind).toBe("inline");
    expect(result.mainText).toBe("Hi and bye");
    expect(result.bgText).toBe("a b");
  });

  it("classifies a single full-line group as standalone", () => {
    const result = classifyLine("(ooh yeah)");
    expect(result.kind).toBe("standalone");
    expect(result.mainText).toBe("");
    expect(result.bgText).toBe("ooh yeah");
  });

  it("classifies multiple groups covering the whole line as standalone", () => {
    const result = classifyLine("(ooh) (yeah)");
    expect(result.kind).toBe("standalone");
    expect(result.mainText).toBe("");
    expect(result.bgText).toBe("ooh yeah");
  });

  it("classifies an unclosed group as skip", () => {
    const result = classifyLine("Hello (ooh");
    expect(result.kind).toBe("skip");
  });

  it("classifies nested groups as skip", () => {
    const result = classifyLine("((ooh))");
    expect(result.kind).toBe("skip");
  });

  it("classifies a trailing unclosed group as skip", () => {
    const result = classifyLine("Hello (ooh) world (ah");
    expect(result.kind).toBe("skip");
  });

  it("leaves a line with an empty group untouched as none", () => {
    const result = classifyLine("Hello ()");
    expect(result.kind).toBe("none");
    expect(result.mainText).toBe("Hello ()");
    expect(result.bgText).toBe("");
  });

  it("classifies a whitespace-only group as none with empty bg text", () => {
    const result = classifyLine("(  )");
    expect(result.kind).toBe("none");
    expect(result.bgText).toBe("");
  });
});

// -- classifyLine: whitespace handling -----------------------------------------

describe("classifyLine: whitespace handling", () => {
  it("trims leading and trailing spaces inside a group for bg text", () => {
    const result = classifyLine("la (  ooh  ) la");
    expect(result.kind).toBe("inline");
    expect(result.bgText).toBe("ooh");
    expect(result.mainText).toBe("la la");
  });

  it("collapses runs of two or more spaces in mainText to one space", () => {
    const result = classifyLine("a  (x)  b");
    expect(result.kind).toBe("inline");
    expect(result.mainText).toBe("a b");
    expect(result.bgText).toBe("x");
  });

  it("classifies a whitespace-only line as none", () => {
    const result = classifyLine("   ");
    expect(result.kind).toBe("none");
    expect(result.bgText).toBe("");
    expect(result.mainText).toBe("   ");
  });

  it("classifies an empty string as none", () => {
    const result = classifyLine("");
    expect(result.kind).toBe("none");
    expect(result.bgText).toBe("");
    expect(result.mainText).toBe("");
  });
});

// -- classifyLine: mixed empty and non-empty groups ----------------------------

describe("classifyLine: mixed empty and non-empty groups", () => {
  it("filters out an empty group when joining bg text", () => {
    const result = classifyLine("Hi (a) and () bye");
    expect(result.kind).toBe("inline");
    expect(result.bgText).toBe("a");
    expect(result.mainText).toBe("Hi and bye");
  });

  it("filters out a whitespace-only group when joining bg text", () => {
    const result = classifyLine("Hi (a) and (   ) bye");
    expect(result.kind).toBe("inline");
    expect(result.bgText).toBe("a");
    expect(result.mainText).toBe("Hi and bye");
  });

  it("classifies a standalone line when the only non-empty group covers everything", () => {
    const result = classifyLine("() (ooh)");
    expect(result.kind).toBe("standalone");
    expect(result.bgText).toBe("ooh");
    expect(result.mainText).toBe("");
  });
});

// -- classifyLine: returned shape ----------------------------------------------

describe("classifyLine: returned shape", () => {
  it("returns a well-formed shape for skip outcomes", () => {
    const result = classifyLine("Hello (ooh");
    expect(result.kind).toBe("skip");
    expect(result.groups).toEqual([]);
    expect(result.bgText).toBe("");
    expect(result.mainText).toBe("Hello (ooh");
  });

  it("returns a well-formed shape for none outcomes with no groups", () => {
    const result = classifyLine("Hello world");
    expect(result.kind).toBe("none");
    expect(result.groups).toEqual([]);
    expect(result.bgText).toBe("");
    expect(result.mainText).toBe("Hello world");
  });

  it("retains scanned groups for none outcomes with empty groups", () => {
    const result = classifyLine("Hello ()");
    expect(result.kind).toBe("none");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].inner).toBe("");
  });

  it("exposes scanned groups for inline outcomes", () => {
    const result = classifyLine("Hi (a) and (b) bye");
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].inner).toBe("a");
    expect(result.groups[1].inner).toBe("b");
  });
});

// -- extractInlineFromLine -----------------------------------------------------

describe("extractInlineFromLine", () => {
  it("extracts an inline group from an untimed line", () => {
    const line: LyricLine = { id: "1", text: "Hello (ooh) world", agentId: "v1" };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(lineText(result)).toBe("Hello world");
    expect(backgroundText(result)).toBe("ooh");
  });

  it("appends to existing backgroundText on an untimed line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh)",
      agentId: "v1",
      backgroundText: "ah",
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(lineText(result)).toBe("Hello");
    expect(backgroundText(result)).toBe("ah ooh");
  });

  it("sets backgroundText to just the extracted text when none exists", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      backgroundText: undefined,
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(backgroundText(result)).toBe("ooh");
  });

  it("returns the same reference for a line with no parentheses", () => {
    const line: LyricLine = { id: "1", text: "Hello world", agentId: "v1" };
    expect(extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false })).toBe(line);
  });

  it("returns the same reference for a standalone line", () => {
    const line: LyricLine = { id: "1", text: "(ooh yeah)", agentId: "v1" };
    expect(extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false })).toBe(line);
  });

  it("returns the same reference for a skip line", () => {
    const line: LyricLine = { id: "1", text: "Hello (ooh", agentId: "v1" };
    expect(extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false })).toBe(line);
  });

  it("preserves begin and end on a line-synced line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hi (ooh) there",
      agentId: "v1",
      begin: 1,
      end: 3,
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(lineText(result)).toBe("Hi there");
    expect(backgroundText(result)).toBe("ooh");
    expect(result.begin).toBe(1);
    expect(result.end).toBe(3);
    expect(result.words).toBeUndefined();
  });

  it("extracts an inline group from a word-synced line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hi (ooh) there",
      agentId: "v1",
      words: [
        { id: "w1", text: "Hi", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w2", text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w3", text: "there", sep: "", begin: 2, end: 3, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(result).not.toBe(line);
    expect(lineText(result)).toBe("Hi there");
    expect(backgroundText(result)).toBe("ooh");
    expect(timedSyllables(backgroundTrack(result))).toEqual([
      { text: "ooh", sep: "", begin: 1, end: 2, joinsNext: false },
    ]);
    expect(timedSyllables(mainTrack(result))).toEqual([
      { text: "Hi", sep: " ", begin: 0, end: 1, joinsNext: false },
      { text: "there", sep: "", begin: 2, end: 3, joinsNext: false },
    ]);
  });

  it("does not mutate the input line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      backgroundText: "ah",
    };
    extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(lineText(line)).toBe("Hello (ooh) world");
    expect(backgroundText(line)).toBe("ah");
  });

  it("returns the same reference for a line-synced line carrying manual background words", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hi (ooh) there",
      agentId: "v1",
      begin: 1,
      end: 3,
      backgroundWords: [{ id: "w4", text: "clap", sep: "", begin: 1.2, end: 1.8, joinsNext: false }],
    };
    expect(extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false })).toBe(line);
  });

  it("returns the same reference for an untimed line carrying manual background words", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hi (ooh) there",
      agentId: "v1",
      backgroundWords: [{ id: "w5", text: "clap", sep: "", begin: 1.2, end: 1.8, joinsNext: false }],
    };
    expect(extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false })).toBe(line);
  });

  it("still extracts a line-synced line when backgroundWords is an empty array", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hi (ooh) there",
      agentId: "v1",
      begin: 1,
      end: 3,
      backgroundWords: [],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(lineText(result)).toBe("Hi there");
    expect(backgroundText(result)).toBe("ooh");
  });
});

// -- extractInlineFromLine: word-synced extraction -----------------------------

describe("extractInlineFromLine: word-synced extraction", () => {
  it("extracts a mid-line paren word and preserves survivor timing", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      words: [
        { id: "w6", text: "Hello", sep: " ", begin: 0.5, end: 1.2, joinsNext: false },
        { id: "w7", text: "(ooh)", sep: " ", begin: 1.2, end: 1.9, joinsNext: false },
        { id: "w8", text: "world", sep: "", begin: 1.9, end: 2.7, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(result).not.toBe(line);
    expect(lineText(result)).toBe("Hello world");
    expect(backgroundText(result)).toBe("ooh");
    expect(timedSyllables(backgroundTrack(result))).toEqual([
      { text: "ooh", sep: "", begin: 1.2, end: 1.9, joinsNext: false },
    ]);
    expect(timedSyllables(mainTrack(result))).toEqual([
      { text: "Hello", sep: " ", begin: 0.5, end: 1.2, joinsNext: false },
      { text: "world", sep: "", begin: 1.9, end: 2.7, joinsNext: false },
    ]);
  });

  it("extracts a trailing paren word and trims the last survivor's trailing space", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh)",
      agentId: "v1",
      words: [
        { id: "w9", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w10", text: "(ooh)", sep: "", begin: 1, end: 2, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(result).not.toBe(line);
    expect(lineText(result)).toBe("Hello");
    expect(backgroundText(result)).toBe("ooh");
    expect(timedSyllables(mainTrack(result))).toEqual([{ text: "Hello", sep: "", begin: 0, end: 1, joinsNext: false }]);
  });

  it("extracts a multi-token group spanning several words", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh yeah) world",
      agentId: "v1",
      words: [
        { id: "w11", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w12", text: "(ooh", sep: " ", begin: 1, end: 1.5, joinsNext: false },
        { id: "w13", text: "yeah)", sep: " ", begin: 1.5, end: 2, joinsNext: false },
        { id: "w14", text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(result).not.toBe(line);
    expect(lineText(result)).toBe("Hello world");
    expect(backgroundText(result)).toBe("ooh yeah");
    expect(timedSyllables(mainTrack(result))).toEqual([
      { text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
      { text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
    ]);
  });

  it("returns the same reference when a paren is glued onto a word token", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello(ooh) world",
      agentId: "v1",
      words: [
        { id: "w15", text: "Hello(ooh)", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w16", text: "world", sep: "", begin: 1, end: 2, joinsNext: false },
      ],
    };
    expect(extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false })).toBe(line);
  });

  it("preserves explicit and syllableGroupId fields on survivors", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      words: [
        { id: "w17", text: "Hello", sep: " ", begin: 0, end: 1, explicit: true, joinsNext: false },
        { id: "w18", text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w19", text: "world", sep: "", begin: 2, end: 3, explicit: true, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(timedSyllables(mainTrack(result))).toEqual([
      { text: "Hello", sep: " ", begin: 0, end: 1, explicit: true, joinsNext: false },
      { text: "world", sep: "", begin: 2, end: 3, explicit: true, joinsNext: false },
    ]);
  });

  it("extracts cleanly when the line has syllable-split words", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hel|lo (ooh) world",
      agentId: "v1",
      words: [
        { id: "w20", text: "Hel", sep: "", begin: 0, end: 0.5, joinsNext: true },
        { id: "w21", text: "lo", sep: " ", begin: 0.5, end: 1, joinsNext: false },
        { id: "w22", text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w23", text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(result).not.toBe(line);
    expect(lineText(result)).toBe("Hel|lo world");
    expect(backgroundText(result)).toBe("ooh");
    expect(timedSyllables(mainTrack(result))).toEqual([
      { text: "Hel", sep: "", begin: 0, end: 0.5, joinsNext: true },
      { text: "lo", sep: " ", begin: 0.5, end: 1, joinsNext: false },
      { text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
    ]);
  });

  it("returns the same reference when the line already has background words", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      words: [
        { id: "w24", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w25", text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w26", text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
      ],
      backgroundWords: [{ id: "w27", text: "ah", sep: "", begin: 0, end: 1, joinsNext: false }],
    };
    expect(extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false })).toBe(line);
  });

  it("appends to existing backgroundText on a word-synced line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      backgroundText: "ah",
      words: [
        { id: "w28", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w29", text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w30", text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(backgroundText(result)).toBe("ah ooh");
  });

  it("does not mutate the input line or its words array", () => {
    const words = [
      { id: "w31", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w32", text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
      { id: "w33", text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
    ];
    const line: LyricLine = { id: "1", text: "Hello (ooh) world", agentId: "v1", words };
    extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(lineText(line)).toBe("Hello (ooh) world");
    expect(line.words).toBe(words);
    expect(line.words).toEqual([
      { text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
      { text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
      { text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
    ]);
  });

  it("returns the same reference for a word-synced standalone line", () => {
    const line: LyricLine = {
      id: "1",
      text: "(ooh yeah)",
      agentId: "v1",
      words: [
        { id: "w34", text: "(ooh", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w35", text: "yeah)", sep: "", begin: 1, end: 2, joinsNext: false },
      ],
    };
    expect(extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false })).toBe(line);
  });
});

// -- extractBackgroundVocals: specification table ------------------------------

describe("extractBackgroundVocals: specification table", () => {
  it("extracts an inline line regardless of mergeStandaloneLines", () => {
    for (const mergeStandaloneLines of [true, false]) {
      const lines = [createLine({ id: "1", text: "A (ooh) B" })];
      const result = extractBackgroundVocals(lines, { mergeStandaloneLines, preserveBrackets: false });
      expect(result).toHaveLength(1);
      expect(lineText(result[0])).toBe("A B");
      expect(backgroundText(result[0])).toBe("ooh");
    }
  });

  it("merges a standalone line into the previous line when merge is enabled", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(lineText(result[0])).toBe("Real line");
    expect(backgroundText(result[0])).toBe("ooh yeah");
  });

  it("leaves a standalone line in place when merge is disabled", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
  });

  it("merges consecutive standalone lines into the same previous line", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({ id: "2", text: "(ooh)" }),
      createLine({ id: "3", text: "(yeah)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(lineText(result[0])).toBe("Real line");
    expect(backgroundText(result[0])).toBe("ooh yeah");
  });

  it("does not merge a leading standalone line with no valid predecessor", () => {
    const lines = [createLine({ id: "1", text: "(ooh)" }), createLine({ id: "2", text: "Real line" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
  });

  it("does not merge into an empty-text predecessor", () => {
    const lines = [
      createLine({ id: "1", text: "Real" }),
      createLine({ id: "2", text: "" }),
      createLine({ id: "3", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
    expect(result[2]).toBe(lines[2]);
  });

  it("does not merge when the predecessor is a linked line", () => {
    const lines = [
      createLine({ id: "1", text: "Chorus", groupId: "g1", instanceIdx: 0 }),
      createLine({ id: "2", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
  });

  it("does not merge when the standalone line is itself linked", () => {
    const lines = [
      createLine({ id: "1", text: "Real" }),
      createLine({ id: "2", text: "(ooh)", groupId: "g1", instanceIdx: 0 }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
  });

  it("merges a standalone line into a predecessor that was itself inline-extracted", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) B" }), createLine({ id: "2", text: "(yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(lineText(result[0])).toBe("A B");
    expect(backgroundText(result[0])).toBe("ooh yeah");
  });
});

// -- extractBackgroundVocals: none and skip lines -----------------------------

describe("extractBackgroundVocals: none and skip lines", () => {
  it("pushes a none line by reference", () => {
    const lines = [createLine({ id: "1", text: "Plain line" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(lines[0]);
  });

  it("pushes a skip line by reference", () => {
    const lines = [createLine({ id: "1", text: "Hello (ooh" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(lines[0]);
  });

  it("does not merge a standalone line into a skip predecessor", () => {
    const lines = [createLine({ id: "1", text: "Hello (ooh" }), createLine({ id: "2", text: "(yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
  });
});

// -- extractBackgroundVocals: timing-aware standalone merge -------------------

describe("extractBackgroundVocals: timing-aware standalone merge", () => {
  it("merges an untimed standalone line into an untimed predecessor as text only", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(backgroundText(result[0])).toBe("ooh yeah");
    expect(result[0].backgroundWords).toBeUndefined();
  });

  it("carries word-synced standalone timing into an untimed predecessor with no background", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { text: "yeah", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ]);
    expect(backgroundText(result[0])).toBe("ooh yeah");
  });

  it("appends carried words after the predecessor's existing background words", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "ah ",
        backgroundWords: [{ text: "ah", sep: " ", begin: 1.0, end: 1.5 }],
      }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ah", sep: " ", begin: 1.0, end: 1.5, joinsNext: false },
      { text: "ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { text: "yeah", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ]);
    expect(backgroundText(result[0])).toBe("ah ooh yeah");
  });

  it("falls back to text-only when predecessor has background text but no words", () => {
    const lines = [
      createLine({ id: "1", text: "Real line", backgroundText: "ah" }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("ah ooh yeah");
    expect(result[0].backgroundWords).toBeUndefined();
  });

  it("seeds background words from a line-synced standalone via createInitialBgWords", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({ id: "2", text: "(ooh)", begin: 4.0, end: 6.0 }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("ooh");
    const bgWords = result[0].backgroundWords;
    expect(bgWords).toHaveLength(1);
    expect(bgWords?.[0].text).toBe("ooh");
    expect(bgWords?.[0].begin).toBe(4.0);
    expect(bgWords?.[0].end).toBe(6.0);
  });

  it("spans the standalone time range across multiple words from a line-synced standalone", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({ id: "2", text: "(ooh yeah)", begin: 4.0, end: 6.0 }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    const bgWords = result[0].backgroundWords;
    expect(bgWords).toHaveLength(2);
    expect(bgWords?.[0].begin).toBe(4.0);
    expect(bgWords?.[bgWords.length - 1].end).toBe(6.0);
  });

  it("does not merge an untimed standalone into a predecessor with timed background words", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "ah",
        backgroundWords: [{ text: "ah", begin: 1.0, end: 1.5 }],
      }),
      createLine({ id: "2", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ah", sep: "", begin: 1.0, end: 1.5, joinsNext: false },
    ]);
  });

  it("carries matching word timing when standalone word count does not match bg text", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "( ooh yeah )",
        words: [
          { text: "(", sep: " ", begin: 5.0, end: 5.2 },
          { text: "ooh", sep: " ", begin: 5.2, end: 5.6 },
          { text: "yeah", sep: " ", begin: 5.6, end: 6.0 },
          { text: ")", begin: 6.0, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("ooh yeah");
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ooh", sep: " ", begin: 5.2, end: 5.6, joinsNext: false },
      { text: "yeah", sep: "", begin: 5.6, end: 6.0, joinsNext: false },
    ]);
  });
});

// -- extractBackgroundVocals: merge gate -------------------------------------

describe("extractBackgroundVocals: merge gate", () => {
  it("does not merge a standalone line into a standalone predecessor", () => {
    const lines = [createLine({ id: "1", text: "(ooh)" }), createLine({ id: "2", text: "(yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
  });

  it("still merges a standalone line into a real lyric predecessor", () => {
    const lines = [
      createLine({ id: "1", text: "Real" }),
      createLine({ id: "2", text: "(ooh)" }),
      createLine({ id: "3", text: "(yeah)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(lineText(result[0])).toBe("Real");
    expect(backgroundText(result[0])).toBe("ooh yeah");
  });
});

// -- extractBackgroundVocals: reference stability -----------------------------

describe("extractBackgroundVocals: reference stability", () => {
  it("returns every line by reference when no parentheses are present", () => {
    for (const mergeStandaloneLines of [true, false]) {
      const lines = [
        createLine({ id: "1", text: "First line" }),
        createLine({ id: "2", text: "Second line" }),
        createLine({ id: "3", text: "Third line" }),
      ];
      const result = extractBackgroundVocals(lines, { mergeStandaloneLines, preserveBrackets: false });
      expect(result).toHaveLength(lines.length);
      for (let i = 0; i < lines.length; i++) {
        expect(result[i]).toBe(lines[i]);
      }
    }
  });
});

// -- extractBackgroundVocals: existing backgroundText -------------------------

describe("extractBackgroundVocals: existing backgroundText", () => {
  it("appends a merged standalone bg text after the predecessor's existing bg text", () => {
    const lines = [
      createLine({ id: "1", text: "Real line", backgroundText: "ah" }),
      createLine({ id: "2", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("ah ooh");
  });
});

// -- extractBackgroundVocals: input not mutated -------------------------------

describe("extractBackgroundVocals: input not mutated", () => {
  it("does not mutate the input array or its line objects", () => {
    const lines = [
      createLine({ id: "1", text: "A (ooh) B", backgroundText: "ah" }),
      createLine({ id: "2", text: "(yeah)" }),
      createLine({ id: "3", text: "Plain" }),
    ];
    const originalLength = lines.length;
    extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(lines).toHaveLength(originalLength);
    expect(lineText(lines[0])).toBe("A (ooh) B");
    expect(backgroundText(lines[0])).toBe("ah");
    expect(lineText(lines[1])).toBe("(yeah)");
    expect(lineText(lines[2])).toBe("Plain");
  });

  it("does not mutate a timed standalone line or its words array", () => {
    const standaloneWords = [
      { id: "w36", text: "(ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { id: "w37", text: "yeah)", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ];
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({ id: "2", text: "(ooh yeah)", words: standaloneWords }),
    ];
    const standaloneWordsRef = lines[1].words;
    extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(lines).toHaveLength(2);
    expect(lineText(lines[1])).toBe("(ooh yeah)");
    expect(lines[1].words).toBe(standaloneWordsRef);
    expect(lines[1].words).toEqual([
      { text: "(ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { text: "yeah)", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ]);
    expect(lines[0].backgroundWords).toBeUndefined();
  });
});

// -- extractBackgroundVocals: idempotence -------------------------------------

describe("extractBackgroundVocals: idempotence", () => {
  it("yields no further changes when run on its own output", () => {
    const lines = [
      createLine({ id: "1", text: "A (ooh) B" }),
      createLine({ id: "2", text: "(yeah)" }),
      createLine({ id: "3", text: "Plain line" }),
      createLine({ id: "4", text: "C (ah) D" }),
    ];
    const first = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    const second = extractBackgroundVocals(first, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(second).toHaveLength(first.length);
    for (let i = 0; i < first.length; i++) {
      expect(second[i]).toBe(first[i]);
      expect(lineText(second[i])).toBe(lineText(first[i]));
      expect(backgroundText(second[i])).toBe(backgroundText(first[i]));
    }
  });

  it("yields no further changes for a mix including timed standalone lines", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        words: [
          { text: "Real", sep: " ", begin: 0, end: 1 },
          { text: "line", begin: 1, end: 2 },
        ],
      }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
      createLine({ id: "3", text: "Plain line" }),
    ];
    const first = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    const second = extractBackgroundVocals(first, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(second).toHaveLength(first.length);
    for (let i = 0; i < first.length; i++) {
      expect(second[i]).toBe(first[i]);
      expect(backgroundText(second[i])).toBe(backgroundText(first[i]));
      expect(timedSyllables(backgroundTrack(second[i]))).toEqual(timedSyllables(backgroundTrack(first[i])));
    }
  });
});

// -- re-paste doubling --------------------------------------------------------

describe("re-paste doubling", () => {
  it("does not double background text when a standalone line is re-merged", () => {
    const first = extractBackgroundVocals(
      [
        { id: "a", text: "hello", agentId: "v1" },
        { id: "b", text: "(ooh)", agentId: "v1" },
      ],
      { mergeStandaloneLines: true, preserveBrackets: false },
    );
    expect(first).toHaveLength(1);
    expect(backgroundText(first[0])).toBe("ooh");
    expect(backgroundTrack(first[0])?.source).toBe("extraction");

    const second = extractBackgroundVocals([first[0], { id: "b", text: "(ooh)", agentId: "v1" }], {
      mergeStandaloneLines: true,
      preserveBrackets: false,
    });
    expect(second).toHaveLength(1);
    expect(backgroundText(second[0])).toBe("ooh");
  });

  it("keeps manually entered background when a standalone line merges in", () => {
    const merged = extractBackgroundVocals(
      [
        { id: "a", text: "hello", agentId: "v1", backgroundText: "clap", backgroundTextSource: "manual" },
        { id: "b", text: "(ooh)", agentId: "v1" },
      ],
      { mergeStandaloneLines: true, preserveBrackets: false },
    );
    expect(backgroundText(merged[0])).toBe("clap ooh");
    expect(backgroundTrack(merged[0])?.source).toBe("manual");
  });
});

// -- provenance: inline extraction --------------------------------------------

describe("extractInlineFromLine: provenance", () => {
  it("stamps extraction source on a freshly extracted untimed line", () => {
    const line: LyricLine = { id: "1", text: "Hello (ooh) world", agentId: "v1" };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(backgroundText(result)).toBe("ooh");
    expect(backgroundTrack(result)?.source).toBe("extraction");
  });

  it("replaces extraction-sourced background instead of appending on re-paste", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh)",
      agentId: "v1",
      backgroundText: "ooh",
      backgroundTextSource: "extraction",
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(lineText(result)).toBe("Hello");
    expect(backgroundText(result)).toBe("ooh");
    expect(backgroundTrack(result)?.source).toBe("extraction");
  });

  it("appends onto manual background and keeps the manual source", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh)",
      agentId: "v1",
      backgroundText: "clap",
      backgroundTextSource: "manual",
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(backgroundText(result)).toBe("clap ooh");
    expect(backgroundTrack(result)?.source).toBe("manual");
  });

  it("treats undefined provenance as manual and appends conservatively", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh)",
      agentId: "v1",
      backgroundText: "clap",
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(backgroundText(result)).toBe("clap ooh");
    expect(backgroundTrack(result)?.source).toBe("manual");
  });

  it("stamps extraction source on a freshly extracted word-synced line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      words: [
        { id: "w38", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w39", text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w40", text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(backgroundText(result)).toBe("ooh");
    expect(backgroundTrack(result)?.source).toBe("extraction");
  });

  it("replaces extraction-sourced background on a word-synced re-paste", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      backgroundText: "ooh",
      backgroundTextSource: "extraction",
      words: [
        { id: "w41", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w42", text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w43", text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(backgroundText(result)).toBe("ooh");
    expect(backgroundTrack(result)?.source).toBe("extraction");
  });

  it("appends onto manual background on a word-synced line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      backgroundText: "clap",
      backgroundTextSource: "manual",
      words: [
        { id: "w44", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w45", text: "(ooh)", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w46", text: "world", sep: "", begin: 2, end: 3, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(backgroundText(result)).toBe("clap ooh");
    expect(backgroundTrack(result)?.source).toBe("manual");
  });
});

// -- provenance: standalone merge ---------------------------------------------

describe("extractBackgroundVocals: standalone merge provenance", () => {
  it("stamps extraction source when an untimed standalone merges into a clean predecessor", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(backgroundText(result[0])).toBe("ooh");
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });

  it("keeps manual source when a standalone merges into a manual-background predecessor", () => {
    const lines = [
      createLine({ id: "1", text: "Real line", backgroundText: "ah", backgroundTextSource: "manual" }),
      createLine({ id: "2", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(backgroundText(result[0])).toBe("ah ooh");
    expect(backgroundTrack(result[0])?.source).toBe("manual");
  });

  it("treats undefined-provenance background text as manual on standalone merge", () => {
    const lines = [
      createLine({ id: "1", text: "Real line", backgroundText: "ah" }),
      createLine({ id: "2", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(backgroundText(result[0])).toBe("ah ooh");
    expect(backgroundTrack(result[0])?.source).toBe("manual");
  });

  it("replaces extraction-sourced background text on standalone re-merge", () => {
    const lines = [
      createLine({ id: "1", text: "Real line", backgroundText: "ooh", backgroundTextSource: "extraction" }),
      createLine({ id: "2", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(backgroundText(result[0])).toBe("ooh");
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });

  it("merges two standalone lines into a clean predecessor within one pass", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({ id: "2", text: "(ooh)" }),
      createLine({ id: "3", text: "(ah)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("ooh ah");
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });

  it("carries timed standalone words and stamps extraction source on a clean predecessor", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { text: "yeah", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ]);
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });

  it("combines timed standalone words onto manual background words and keeps manual source", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "ah ",
        backgroundTextSource: "manual",
        backgroundWords: [{ text: "ah", sep: " ", begin: 1.0, end: 1.5 }],
      }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ah", sep: " ", begin: 1.0, end: 1.5, joinsNext: false },
      { text: "ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { text: "yeah", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ]);
    expect(backgroundTrack(result[0])?.source).toBe("manual");
  });

  it("replaces extraction-sourced background words when a timed standalone re-merges", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "ooh yeah",
        backgroundTextSource: "extraction",
        backgroundWords: [
          { text: "ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah", begin: 5.6, end: 6.2 },
        ],
      }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { text: "yeah", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ]);
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });

  it("merges a timed standalone into an untimed extraction-sourced predecessor by replacement", () => {
    const lines = [
      createLine({ id: "1", text: "Real line", backgroundText: "ooh", backgroundTextSource: "extraction" }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(backgroundText(result[0])).toBe("ooh yeah");
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { text: "yeah", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ]);
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });

  it("merges an untimed standalone into a predecessor with extraction-sourced background words", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "ah",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "ah", begin: 1.0, end: 1.5 }],
      }),
      createLine({ id: "2", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("ooh");
    expect(result[0].backgroundWords).toBeUndefined();
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });
});

// -- mergeStandaloneLines disabled --------------------------------------------

describe("extractBackgroundVocals: standalone merge disabled", () => {
  it("leaves standalone all-parens lines untouched but still extracts inline lines", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) B" }), createLine({ id: "2", text: "(yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(result).toHaveLength(2);
    expect(lineText(result[0])).toBe("A B");
    expect(backgroundText(result[0])).toBe("ooh");
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
    expect(result[1]).toBe(lines[1]);
  });
});

// -- re-paste idempotence -----------------------------------------------------

describe("extractBackgroundVocals: re-paste idempotence with provenance", () => {
  it("is a no-op on its own already-extracted standalone-merge output", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh)" })];
    const first = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    const second = extractBackgroundVocals(first, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(second).toHaveLength(first.length);
    for (let i = 0; i < first.length; i++) {
      expect(second[i]).toBe(first[i]);
    }
  });

  it("is a no-op on its own already-extracted inline output", () => {
    const lines = [createLine({ id: "1", text: "Hello (ooh) world" })];
    const first = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    const second = extractBackgroundVocals(first, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(second[0]).toBe(first[0]);
    expect(backgroundText(second[0])).toBe(backgroundText(first[0]));
    expect(backgroundTrack(second[0])?.source).toBe("extraction");
  });
});

// -- linked lines -------------------------------------------------------------
//
// Inline extraction is an in-place content edit, so it is intentionally applied
// to linked lines (lines belonging to a timeline group/instance). These tests
// pin that an inline-extracted linked line keeps its link metadata intact and
// that linked siblings carrying identical text extract identically, so the
// whole-list transform never desyncs an instance set.

describe("extractInlineFromLine: linked lines", () => {
  it("extracts an untimed inline group and keeps link metadata intact", () => {
    const line: LyricLine = {
      id: "l1",
      text: "Hello (ooh)",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(lineText(result)).toBe("Hello");
    expect(backgroundText(result)).toBe("ooh");
    expect(result.groupId).toBe("g1");
    expect(result.instanceIdx).toBe(0);
    expect(result.templateLineIdx).toBe(0);
  });

  it("extracts a word-synced inline group and keeps link metadata intact", () => {
    const line: LyricLine = {
      id: "l1",
      text: "Hello (ooh)",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 1,
      templateLineIdx: 2,
      words: [
        { id: "w47", text: "Hello", sep: " ", begin: 30, end: 31, joinsNext: false },
        { id: "w48", text: "(ooh)", sep: "", begin: 31, end: 32, joinsNext: false },
      ],
    };
    const result = extractInlineFromLine(line, { mergeStandaloneLines: false, preserveBrackets: false });
    expect(lineText(result)).toBe("Hello");
    expect(backgroundText(result)).toBe("ooh");
    expect(timedSyllables(mainTrack(result))).toEqual([
      { text: "Hello", sep: "", begin: 30, end: 31, joinsNext: false },
    ]);
    expect(result.groupId).toBe("g1");
    expect(result.instanceIdx).toBe(1);
    expect(result.templateLineIdx).toBe(2);
  });
});

describe("extractBackgroundVocals: linked sibling lines", () => {
  it("extracts both untimed linked siblings identically", () => {
    const lines = [
      createLine({ id: "s0", text: "Hello (ooh)", groupId: "g1", instanceIdx: 0 }),
      createLine({ id: "s1", text: "Hello (ooh)", groupId: "g1", instanceIdx: 1 }),
    ].map((line, idx) => ({ ...line, templateLineIdx: 0, instanceIdx: idx }));

    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });

    expect(result).toHaveLength(2);
    for (const line of result) {
      expect(lineText(line)).toBe("Hello");
      expect(backgroundText(line)).toBe("ooh");
      expect(line.groupId).toBe("g1");
      expect(line.templateLineIdx).toBe(0);
    }
    expect(result[0].instanceIdx).toBe(0);
    expect(result[1].instanceIdx).toBe(1);
  });

  it("extracts both word-synced linked siblings identically while keeping instance timing", () => {
    const s0: LyricLine = {
      id: "s0",
      text: "Hello (ooh)",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
      words: [
        { id: "w49", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w50", text: "(ooh)", sep: "", begin: 1, end: 2, joinsNext: false },
      ],
    };
    const s1: LyricLine = {
      id: "s1",
      text: "Hello (ooh)",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 1,
      templateLineIdx: 0,
      words: [
        { id: "w51", text: "Hello", sep: " ", begin: 30, end: 31.5, joinsNext: false },
        { id: "w52", text: "(ooh)", sep: "", begin: 31.5, end: 33, joinsNext: false },
      ],
    };

    const result = extractBackgroundVocals([s0, s1], { mergeStandaloneLines: true, preserveBrackets: false });

    expect(result).toHaveLength(2);
    expect(lineText(result[0])).toBe("Hello");
    expect(lineText(result[1])).toBe("Hello");
    expect(backgroundText(result[0])).toBe("ooh");
    expect(backgroundText(result[1])).toBe("ooh");
    expect(timedSyllables(mainTrack(result[0]))).toEqual([
      { text: "Hello", sep: "", begin: 0, end: 1, joinsNext: false },
    ]);
    expect(timedSyllables(mainTrack(result[1]))).toEqual([
      { text: "Hello", sep: "", begin: 30, end: 31.5, joinsNext: false },
    ]);
    expect(result[0].groupId).toBe("g1");
    expect(result[1].groupId).toBe("g1");
    expect(result[0].templateLineIdx).toBe(0);
    expect(result[1].templateLineIdx).toBe(0);
  });
});

// -- lineHasInlineParens ------------------------------------------------------

describe("lineHasInlineParens", () => {
  it("returns true for an inline line", () => {
    expect(lineHasInlineParens(createLine({ id: "1", text: "A (ooh) B" }))).toBe(true);
  });

  it("returns false for a plain line", () => {
    expect(lineHasInlineParens(createLine({ id: "1", text: "Plain line" }))).toBe(false);
  });

  it("returns false for a standalone line", () => {
    expect(lineHasInlineParens(createLine({ id: "1", text: "(ooh yeah)" }))).toBe(false);
  });

  it("returns false for a skip line", () => {
    expect(lineHasInlineParens(createLine({ id: "1", text: "Hello (ooh" }))).toBe(false);
  });
});

// -- preserveBrackets: text-only bg -------------------------------------------

describe("preserveBrackets: text-only bg", () => {
  it("wraps a single inline group in one outer pair", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) B" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("A B");
    expect(backgroundText(result[0])).toBe("(ooh)");
  });

  it("wraps multiple inline groups on the same line in one outer pair", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) (yeah) B" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(lineText(result[0])).toBe("A B");
    expect(backgroundText(result[0])).toBe("(ooh yeah)");
  });

  it("merges a standalone into prev with one outer pair", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("(ooh yeah)");
  });

  it("merges multiple consecutive standalones into one outer pair", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({ id: "2", text: "(ooh)" }),
      createLine({ id: "3", text: "(yeah)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("(ooh yeah)");
  });

  it("merges inline-then-standalone same-pass into one outer pair", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) B" }), createLine({ id: "2", text: "(yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("A B");
    expect(backgroundText(result[0])).toBe("(ooh yeah)");
  });

  it("appends a bracketed addition next to existing manual bg text", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "ah",
        backgroundTextSource: "manual",
      }),
      createLine({ id: "2", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("ah (ooh)");
  });

  it("groups multiple bracketed additions inside one pair after manual bg", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "ah",
        backgroundTextSource: "manual",
      }),
      createLine({ id: "2", text: "(ooh)" }),
      createLine({ id: "3", text: "(yeah)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("ah (ooh yeah)");
  });

  it("preserves backgroundTextSource as extraction for fresh additions", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) B" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });

  it("is idempotent on already-bracketed extracted bg (no double wrap)", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) B" })];
    const once = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    const twice = extractBackgroundVocals(once, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(backgroundText(twice[0])).toBe("(ooh)");
    expect(lineText(twice[0])).toBe("A B");
  });

  it("does not change main text under preserveBrackets", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) (yeah) B" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(lineText(result[0])).toBe("A B");
  });

  it("does not peel a trailing ')' from manual bg text", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "my note)",
        backgroundTextSource: "manual",
      }),
      createLine({ id: "2", text: "(ooh)" }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(backgroundText(result[0])).toBe("my note) (ooh)");
  });
});

// -- preserveBrackets: invariants ---------------------------------------------

describe("preserveBrackets: invariants", () => {
  it("regression: off-state inline single group matches pre-task output", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) B" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("A B");
    expect(backgroundText(result[0])).toBe("ooh");
  });

  it("regression: off-state standalone merge matches pre-task output", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("Real line");
    expect(backgroundText(result[0])).toBe("ooh yeah");
  });

  it("off-state and on-state produce different bg text for inline parens", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) B" })];
    const off = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    const on = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(backgroundText(off[0])).toBe("ooh");
    expect(backgroundText(on[0])).toBe("(ooh)");
    expect(backgroundText(off[0])).not.toBe(backgroundText(on[0]));
  });

  it("paren-free line is reference-equality pass-through regardless of flag", () => {
    const lines = [createLine({ id: "1", text: "Plain line" })];
    const off = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    const on = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(off[0]).toBe(lines[0]);
    expect(on[0]).toBe(lines[0]);
  });

  it("inline groups plus same-pass standalone merge yield exactly one outer pair", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) (yeah) B" }), createLine({ id: "2", text: "(la)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    const bg = backgroundText(result[0]) ?? "";
    expect((bg.match(/\(/g) ?? []).length).toBe(1);
    expect((bg.match(/\)/g) ?? []).length).toBe(1);
    expect(bg).toBe("(ooh yeah la)");
  });
});

describe("preserveBrackets: word-synced bg", () => {
  it("brackets a multi-word standalone carried into prev with no existing bg", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "(ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { text: "yeah)", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ]);
    expect(backgroundText(result[0])).toBe("(ooh yeah)");
  });

  it("brackets a single-word standalone", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "(ooh)",
        words: [{ text: "(ooh)", begin: 5.0, end: 5.6 }],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "(ooh)", sep: "", begin: 5.0, end: 5.6, joinsNext: false },
    ]);
    expect(backgroundText(result[0])).toBe("(ooh)");
  });

  it("merges a second standalone into the same outer pair, stripping seam brackets", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "(ooh)",
        words: [{ text: "(ooh)", begin: 5.0, end: 5.5 }],
      }),
      createLine({
        id: "3",
        text: "(yeah)",
        words: [{ text: "(yeah)", begin: 5.6, end: 6.1 }],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "(ooh", sep: " ", begin: 5.0, end: 5.5, joinsNext: false },
      { text: "yeah)", sep: "", begin: 5.6, end: 6.1, joinsNext: false },
    ]);
    expect(backgroundText(result[0])).toBe("(ooh yeah)");
  });

  it("appends bracketed carry next to existing manual bg words without merging into manual pair", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "ah ",
        backgroundWords: [{ text: "ah", sep: " ", begin: 1.0, end: 1.5 }],
        backgroundTextSource: "manual",
      }),
      createLine({
        id: "2",
        text: "(ooh)",
        words: [{ text: "(ooh)", begin: 5.0, end: 5.5 }],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ah", sep: " ", begin: 1.0, end: 1.5, joinsNext: false },
      { text: "(ooh)", sep: "", begin: 5.0, end: 5.5, joinsNext: false },
    ]);
  });

  it("falls back to text-only addition when standalone has no words", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result[0].backgroundWords).toBeUndefined();
    expect(backgroundText(result[0])).toBe("(ooh)");
  });

  it("off-state: word carry is unchanged (regression guard)", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.0, end: 5.6 },
          { text: "yeah)", begin: 5.6, end: 6.2 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: false });
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "ooh", sep: " ", begin: 5.0, end: 5.6, joinsNext: false },
      { text: "yeah", sep: "", begin: 5.6, end: 6.2, joinsNext: false },
    ]);
    expect(backgroundText(result[0])).toBe("ooh yeah");
  });

  it("does not fuse a manually-bracketed bg with a fresh bracketed carry", () => {
    const lines = [
      createLine({
        id: "1",
        text: "Real line",
        backgroundText: "(clap)",
        backgroundWords: [{ text: "(clap)", begin: 1.0, end: 1.5 }],
        backgroundTextSource: "manual",
      }),
      createLine({
        id: "2",
        text: "(ooh)",
        words: [{ text: "(ooh)", begin: 5.0, end: 5.5 }],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(result).toHaveLength(1);
    expect(timedSyllables(backgroundTrack(result[0]))).toEqual([
      { text: "(clap)", sep: " ", begin: 1.0, end: 1.5, joinsNext: false },
      { text: "(ooh)", sep: "", begin: 5.0, end: 5.5, joinsNext: false },
    ]);
  });
});

describe("preserveBrackets: word-synced invariants", () => {
  it("preserves timing values exactly across bracket wrapping", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "(ooh yeah)",
        words: [
          { text: "(ooh", sep: " ", begin: 5.123, end: 5.617 },
          { text: "yeah)", begin: 5.617, end: 6.234 },
        ],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    const w = timedSyllables(backgroundTrack(result[0]));
    expect(w[0].begin).toBe(5.123);
    expect(w[0].end).toBe(5.617);
    expect(w[1].begin).toBe(5.617);
    expect(w[1].end).toBe(6.234);
  });

  it("reconstructed backgroundText stays consistent with bracketed words", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "(ooh)",
        words: [{ text: "(ooh)", begin: 5.0, end: 5.5 }],
      }),
      createLine({
        id: "3",
        text: "(yeah)",
        words: [{ text: "(yeah)", begin: 5.6, end: 6.1 }],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(backgroundText(result[0])).toBe("(ooh yeah)");
  });

  it("does not introduce parens in the main line text", () => {
    const lines = [
      createLine({ id: "1", text: "Real line" }),
      createLine({
        id: "2",
        text: "(ooh)",
        words: [{ text: "(ooh)", begin: 5.0, end: 5.5 }],
      }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true, preserveBrackets: true });
    expect(lineText(result[0])).toBe("Real line");
  });
});

describe("regressions", () => {
  const options = { mergeStandaloneLines: true, preserveBrackets: false };

  it("regression: background vocals extracted on a synced line are stored timed", () => {
    const line = createLine({ id: "a", text: "hello (ooh)", begin: 10, end: 14 });
    const [extracted] = extractBackgroundVocals([line], options);
    expect(backgroundText(extracted)).toBe("ooh");
    expect(timedSyllables(backgroundTrack(extracted))[0].begin).toBe(12);
  });

  it("regression: an untimed standalone line merged into a synced line is stored timed", () => {
    const lines = [createLine({ id: "a", text: "hello", begin: 10, end: 14 }), createLine({ id: "b", text: "(ooh)" })];
    const [merged] = extractBackgroundVocals(lines, options);
    expect(backgroundText(merged)).toBe("ooh");
    expect(timedSyllables(backgroundTrack(merged))[0].begin).toBe(12);
  });

  it("regression: several untimed standalone lines all merge into one synced line", () => {
    const lines = [
      createLine({ id: "a", text: "hello", begin: 10, end: 14 }),
      createLine({ id: "b", text: "(ooh)" }),
      createLine({ id: "c", text: "(yeah)" }),
    ];
    const extracted = extractBackgroundVocals(lines, options);
    expect(extracted).toHaveLength(1);
    expect(timedSyllables(backgroundTrack(extracted[0])).map((word) => word.text.trim())).toEqual(["ooh", "yeah"]);
  });

  it("regression: empty parentheses do not change the timing pulled from a word-synced line", () => {
    const line = createLine({
      id: "a",
      text: "Hi () (ooh)",
      words: [
        { text: "Hi", sep: " ", begin: 0, end: 1 },
        { text: "()", sep: " ", begin: 1, end: 2 },
        { text: "(ooh)", begin: 5, end: 6 },
      ],
    });
    const extracted = extractInlineFromLine(line, options);
    expect(timedSyllables(backgroundTrack(extracted))).toEqual([
      { text: "ooh", sep: "", begin: 5, end: 6, joinsNext: false },
    ]);
  });

  it("regression: a timed standalone after an untimed one keeps its own timing", () => {
    const lines = [
      createLine({ id: "a", text: "hello", begin: 10, end: 14 }),
      createLine({ id: "b", text: "(ooh)" }),
      createLine({ id: "c", text: "(yeah)", begin: 15, end: 16 }),
    ];
    const [merged] = extractBackgroundVocals(lines, options);
    expect(backgroundText(merged)).toBe("ooh yeah");
    expect(timedSyllables(backgroundTrack(merged)).at(-1)).toEqual({
      text: "yeah",
      sep: "",
      begin: 15,
      end: 16,
      joinsNext: false,
    });
  });

  it("regression: an untimed standalone line after an inline word-synced extraction keeps the carried timing", () => {
    const lines = [
      createLine({
        id: "a",
        text: "hello (ooh)",
        words: [
          { text: "hello", sep: " ", begin: 0, end: 1 },
          { text: "(ooh)", begin: 1, end: 2 },
        ],
      }),
      createLine({ id: "b", text: "(yeah)" }),
    ];
    const extracted = extractBackgroundVocals(lines, options);
    expect(extracted).toHaveLength(1);
    expect(timedSyllables(backgroundTrack(extracted[0]))[0]).toEqual({
      text: "ooh",
      sep: " ",
      begin: 1,
      end: 2,
      joinsNext: false,
    });
    expect(backgroundText(extracted[0])).toBe("ooh yeah");
    expect(timedSyllables(backgroundTrack(extracted[0])).map((word) => word.text.trim())).toEqual(["ooh", "yeah"]);
  });
});
