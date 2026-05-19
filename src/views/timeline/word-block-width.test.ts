import { describe, expect, it } from "vitest";
import { MIN_BLOCK_WIDTH, blockWidth, isAtMinWidth } from "@/views/timeline/word-block-width";

describe("word-block-width", () => {
  it("floors narrow words at the minimum", () => {
    expect(blockWidth(2)).toBe(MIN_BLOCK_WIDTH);
    expect(blockWidth(0)).toBe(MIN_BLOCK_WIDTH);
  });

  it("passes wide words through unchanged", () => {
    expect(blockWidth(120)).toBe(120);
  });

  it("flags words below the floor", () => {
    expect(isAtMinWidth(2)).toBe(true);
    expect(isAtMinWidth(MIN_BLOCK_WIDTH)).toBe(false);
    expect(isAtMinWidth(120)).toBe(false);
  });
});
