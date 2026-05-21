import { describe, expect, it } from "vitest";
import { scanParenGroups } from "@/utils/background-vocal-extraction";

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
