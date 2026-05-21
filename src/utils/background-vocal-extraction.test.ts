import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
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
    const result = extractInlineFromLine(line);
    expect(result.text).toBe("Hello world");
    expect(result.backgroundText).toBe("ooh");
  });

  it("appends to existing backgroundText on an untimed line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh)",
      agentId: "v1",
      backgroundText: "ah",
    };
    const result = extractInlineFromLine(line);
    expect(result.text).toBe("Hello");
    expect(result.backgroundText).toBe("ah ooh");
  });

  it("sets backgroundText to just the extracted text when none exists", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      backgroundText: undefined,
    };
    const result = extractInlineFromLine(line);
    expect(result.backgroundText).toBe("ooh");
  });

  it("returns the same reference for a line with no parentheses", () => {
    const line: LyricLine = { id: "1", text: "Hello world", agentId: "v1" };
    expect(extractInlineFromLine(line)).toBe(line);
  });

  it("returns the same reference for a standalone line", () => {
    const line: LyricLine = { id: "1", text: "(ooh yeah)", agentId: "v1" };
    expect(extractInlineFromLine(line)).toBe(line);
  });

  it("returns the same reference for a skip line", () => {
    const line: LyricLine = { id: "1", text: "Hello (ooh", agentId: "v1" };
    expect(extractInlineFromLine(line)).toBe(line);
  });

  it("preserves begin and end on a line-synced line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hi (ooh) there",
      agentId: "v1",
      begin: 1,
      end: 3,
    };
    const result = extractInlineFromLine(line);
    expect(result.text).toBe("Hi there");
    expect(result.backgroundText).toBe("ooh");
    expect(result.begin).toBe(1);
    expect(result.end).toBe(3);
    expect(result.words).toBeUndefined();
  });

  it("returns the same reference for a word-synced inline line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hi (ooh) there",
      agentId: "v1",
      words: [
        { text: "Hi ", begin: 0, end: 1 },
        { text: "(ooh) ", begin: 1, end: 2 },
        { text: "there", begin: 2, end: 3 },
      ],
    };
    expect(extractInlineFromLine(line)).toBe(line);
  });

  it("does not mutate the input line", () => {
    const line: LyricLine = {
      id: "1",
      text: "Hello (ooh) world",
      agentId: "v1",
      backgroundText: "ah",
    };
    extractInlineFromLine(line);
    expect(line.text).toBe("Hello (ooh) world");
    expect(line.backgroundText).toBe("ah");
  });
});

// -- extractBackgroundVocals: specification table ------------------------------

describe("extractBackgroundVocals: specification table", () => {
  it("extracts an inline line regardless of mergeStandaloneLines", () => {
    for (const mergeStandaloneLines of [true, false]) {
      const lines = [createLine({ id: "1", text: "A (ooh) B" })];
      const result = extractBackgroundVocals(lines, { mergeStandaloneLines });
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("A B");
      expect(result[0].backgroundText).toBe("ooh");
    }
  });

  it("merges a standalone line into the previous line when merge is enabled", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].text).toBe("Real line");
    expect(result[0].backgroundText).toBe("ooh yeah");
  });

  it("leaves a standalone line in place when merge is disabled", () => {
    const lines = [createLine({ id: "1", text: "Real line" }), createLine({ id: "2", text: "(ooh yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: false });
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
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].text).toBe("Real line");
    expect(result[0].backgroundText).toBe("ooh yeah");
  });

  it("does not merge a leading standalone line with no valid predecessor", () => {
    const lines = [createLine({ id: "1", text: "(ooh)" }), createLine({ id: "2", text: "Real line" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
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
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
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
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
  });

  it("does not merge when the standalone line is itself linked", () => {
    const lines = [
      createLine({ id: "1", text: "Real" }),
      createLine({ id: "2", text: "(ooh)", groupId: "g1", instanceIdx: 0 }),
    ];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(lines[0]);
    expect(result[1]).toBe(lines[1]);
  });

  it("merges a standalone line into a predecessor that was itself inline-extracted", () => {
    const lines = [createLine({ id: "1", text: "A (ooh) B" }), createLine({ id: "2", text: "(yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].text).toBe("A B");
    expect(result[0].backgroundText).toBe("ooh yeah");
  });
});

// -- extractBackgroundVocals: none and skip lines -----------------------------

describe("extractBackgroundVocals: none and skip lines", () => {
  it("pushes a none line by reference", () => {
    const lines = [createLine({ id: "1", text: "Plain line" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(lines[0]);
  });

  it("pushes a skip line by reference", () => {
    const lines = [createLine({ id: "1", text: "Hello (ooh" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(lines[0]);
  });

  it("merges a standalone line into a skip predecessor with non-empty text", () => {
    const lines = [createLine({ id: "1", text: "Hello (ooh" }), createLine({ id: "2", text: "(yeah)" })];
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].text).toBe("Hello (ooh");
    expect(result[0].backgroundText).toBe("yeah");
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
      const result = extractBackgroundVocals(lines, { mergeStandaloneLines });
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
    const result = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(result).toHaveLength(1);
    expect(result[0].backgroundText).toBe("ah ooh");
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
    extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    expect(lines).toHaveLength(originalLength);
    expect(lines[0].text).toBe("A (ooh) B");
    expect(lines[0].backgroundText).toBe("ah");
    expect(lines[1].text).toBe("(yeah)");
    expect(lines[2].text).toBe("Plain");
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
    const first = extractBackgroundVocals(lines, { mergeStandaloneLines: true });
    const second = extractBackgroundVocals(first, { mergeStandaloneLines: true });
    expect(second).toHaveLength(first.length);
    for (let i = 0; i < first.length; i++) {
      expect(second[i]).toBe(first[i]);
      expect(second[i].text).toBe(first[i].text);
      expect(second[i].backgroundText).toBe(first[i].backgroundText);
    }
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
