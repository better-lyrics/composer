import { separatorKinds } from "@/utils/split-separators";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("separatorKinds", () => {
  it("lists the kinds present in fixed order", () => {
    expect(separatorKinds(["a  b c-d"])).toEqual(["pronunciation", "word", "dash"]);
  });

  it("ignores separators at the edges", () => {
    expect(separatorKinds([" ab "])).toEqual([]);
  });

  it("does not report dashes in literal mode", () => {
    expect(separatorKinds(["to-do"], "literal")).toEqual([]);
  });

  it("merges several values without inventing a separator between them", () => {
    expect(separatorKinds(["ab", "c d"])).toEqual(["pronunciation"]);
  });
});
