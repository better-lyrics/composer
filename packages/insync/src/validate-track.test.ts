import { describe, expect, it } from "vitest";
import type { Ms } from "./time";
import type { Syllable } from "./track";
import { validateTrack } from "./validate-track";

function timed(text: string, begin: number, end: number, joinsNext = false): Syllable {
  return { text, sep: " ", joinsNext, span: [begin as Ms, end as Ms] };
}

describe("validateTrack", () => {
  it("accepts a well-formed track", () => {
    expect(validateTrack([timed("we", 0, 200), timed("glow", 200, 600)])).toEqual({ errors: [], warnings: [] });
  });

  it("reports broken invariants as errors", () => {
    const result = validateTrack([timed("", 0, 200), timed("glow", 600, 200, true)]);
    expect(result.errors).toEqual([
      { index: 0, rule: "empty-text" },
      { index: 1, rule: "begin-after-end" },
      { index: 1, rule: "last-joins-next" },
    ]);
  });

  it("reports times that are not finite numbers", () => {
    const result = validateTrack([timed("we", Number.NaN, Number.NaN), timed("glow", 0, Number.POSITIVE_INFINITY)]);
    expect(result.errors).toEqual([
      { index: 0, rule: "non-finite-time" },
      { index: 1, rule: "non-finite-time" },
    ]);
  });

  it("reports imported overlap as a warning only", () => {
    const result = validateTrack([timed("we", 0, 500), timed("glow", 300, 600)]);
    expect(result).toEqual({ errors: [], warnings: [{ index: 1, rule: "overlaps-previous" }] });
  });
});
