import { describe, expect, it } from "vitest";
import { splitCreditList } from "@/domain/project/credit-list";

describe("splitCreditList", () => {
  it("splits a pasted list into one name per person, conjunction included", () => {
    expect(splitCreditList("Dia Frampton, Dabin Lee, and Michael McEachern", "acts")).toEqual([
      "Dia Frampton",
      "Dabin Lee",
      "Michael McEachern",
    ]);
    expect(splitCreditList("A; B\nC & D", "acts")).toEqual(["A", "B", "C", "D"]);
  });

  it("keeps an act's name whole when it only looks like a list", () => {
    expect(splitCreditList("Simon & Garfunkel", "acts")).toEqual(["Simon & Garfunkel"]);
    expect(splitCreditList("Tyler, The Creator", "acts")).toEqual(["Tyler, The Creator"]);
  });

  it("splits two people joined by a conjunction alone", () => {
    expect(splitCreditList("Dia Frampton & Dabin Lee", "people")).toEqual(["Dia Frampton", "Dabin Lee"]);
  });
});
