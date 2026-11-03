import { isOtherAccountLyric, isOwnLyric } from "@/domain/unison/ownership";
import { describe, expect, it } from "vitest";

const KEY = "k-own";

describe("ownership", () => {
  it("reads a lyric sent by the signed-in key as its own", () => {
    expect(isOwnLyric({ submitter: { keyId: KEY } }, KEY)).toBe(true);
    expect(isOtherAccountLyric({ submitter: { keyId: KEY } }, KEY)).toBe(false);
  });

  it("reads a lyric sent by another key as another account's", () => {
    expect(isOwnLyric({ submitter: { keyId: "k-other" } }, KEY)).toBe(false);
    expect(isOtherAccountLyric({ submitter: { keyId: "k-other" } }, KEY)).toBe(true);
  });

  it("regression: a lyric without a submitter is never read as another account's", () => {
    expect(isOtherAccountLyric({}, KEY)).toBe(false);
  });
});
