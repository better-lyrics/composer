import { describe, expect, it } from "vitest";
import { classifyLine, scanParenGroups } from "@/utils/background-vocal-extraction";

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
