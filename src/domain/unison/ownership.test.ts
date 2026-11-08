import { isOtherAccountLyric } from "@/domain/unison/ownership";
import { describe, expect, it } from "vitest";

const KEY = "k-own";

describe("ownership", () => {
  it("regression: a lyric without a submitter is never read as another account's", () => {
    expect(isOtherAccountLyric({}, KEY)).toBe(false);
  });
});
