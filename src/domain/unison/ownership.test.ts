import { describe, expect, it } from "vitest";
import { isOwnLyric } from "@/domain/unison/ownership";

const KEY = "k-own";

describe("ownership", () => {
  it("regression: a lyric without a submitter is never read as the user's own", () => {
    expect(isOwnLyric({}, KEY)).toBe(false);
  });
});
