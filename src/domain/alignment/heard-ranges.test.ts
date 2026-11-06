import { describe, expect, it } from "vitest";
import { coversSpan, mergeRanges, readHeardRanges, withoutSpans } from "@/domain/alignment/heard-ranges";

describe("heard ranges", () => {
  it("merges overlapping runs and cuts re-aligned spans out", () => {
    const heard = mergeRanges([
      [30, 40],
      [10, 20],
      [18, 25],
    ]);
    expect(heard).toEqual([
      [10, 25],
      [30, 40],
    ]);
    expect(withoutSpans(heard, [{ begin: 12, end: 14 }])).toEqual([
      [10, 12],
      [14, 25],
      [30, 40],
    ]);
  });

  it("covers a span only when one run holds all of it, within the update tolerance", () => {
    expect(coversSpan([[10.3, 19.8]], 10, 20)).toBe(true);
    expect(
      coversSpan(
        [
          [10, 14],
          [16, 20],
        ],
        11,
        19,
      ),
    ).toBe(false);
  });

  it("reads only well-formed saved ranges", () => {
    expect(readHeardRanges([[1, 2], ["x", 3], [5, 4], null])).toEqual([[1, 2]]);
    expect(readHeardRanges("nope")).toEqual([]);
  });
});
