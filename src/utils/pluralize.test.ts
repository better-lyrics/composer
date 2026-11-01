import { pluralWord, pluralize } from "@/utils/pluralize";
import { describe, expect, it } from "vitest";

describe("pluralize", () => {
  it("uses the singular for exactly one", () => {
    expect(pluralize(1, "line")).toBe("1 line");
  });

  it("adds an s for any other count", () => {
    expect(pluralize(2, "line")).toBe("2 lines");
    expect(pluralize(12, "result")).toBe("12 results");
  });

  it("uses the plural for zero", () => {
    expect(pluralize(0, "line")).toBe("0 lines");
  });

  it("uses a custom plural when given", () => {
    expect(pluralize(2, "match", "matches")).toBe("2 matches");
    expect(pluralize(1, "match", "matches")).toBe("1 match");
  });

  describe("edge cases", () => {
    it("treats a negative count like any count that is not one", () => {
      expect(pluralize(-1, "line")).toBe("-1 lines");
      expect(pluralize(-2, "line")).toBe("-2 lines");
    });

    it("treats a fractional count like any count that is not one", () => {
      expect(pluralize(1.5, "second")).toBe("1.5 seconds");
    });

    it("keeps a multi-word singular intact", () => {
      expect(pluralize(3, "repeating section")).toBe("3 repeating sections");
    });
  });
});

describe("pluralWord", () => {
  it("returns only the word for the count", () => {
    expect(pluralWord(1, "line")).toBe("line");
    expect(pluralWord(0, "line")).toBe("lines");
    expect(pluralWord(3, "line")).toBe("lines");
  });

  it("supports verbs whose singular is the longer form", () => {
    expect(pluralWord(1, "contains", "contain")).toBe("contains");
    expect(pluralWord(2, "contains", "contain")).toBe("contain");
  });
});
