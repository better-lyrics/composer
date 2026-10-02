import { describe, expect, it } from "vitest";
import { songEndOrUnbounded } from "@/utils/timing/song-end";

describe("songEndOrUnbounded", () => {
  it("keeps a known song length", () => {
    expect(songEndOrUnbounded(180.5)).toBe(180.5);
  });

  describe("edge cases", () => {
    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      "has no song end for a length of %s",
      (duration) => {
        expect(songEndOrUnbounded(duration)).toBe(Number.POSITIVE_INFINITY);
      },
    );

    it("keeps a very short song", () => {
      expect(songEndOrUnbounded(0.001)).toBe(0.001);
    });
  });
});
