import { chunkCount, nextChunk } from "@/domain/spectrum/chunk-order";
import { describe, expect, it } from "vitest";

function drain(pending: Set<number>, focus: number): number[] {
  const order: number[] = [];
  for (let chunk = nextChunk(pending, focus); chunk !== null; chunk = nextChunk(pending, focus)) {
    order.push(chunk);
    pending.delete(chunk);
  }
  return order;
}

describe("nextChunk", () => {
  it("visits the focus, then forward chunks before backward ones, ties going forward", () => {
    expect(drain(new Set([0, 1, 2, 3, 4, 5]), 3)).toEqual([3, 4, 5, 2, 1, 0]);
  });

  it("follows a new focus mid drain", () => {
    const pending = new Set(Array.from({ length: 12 }, (_, i) => i));
    for (let i = 0; i < 2; i++) pending.delete(nextChunk(pending, 0) ?? -1);
    expect(nextChunk(pending, 9)).toBe(9);
  });

  describe("edge cases", () => {
    it("returns null when nothing is pending", () => {
      expect(nextChunk(new Set(), 0)).toBeNull();
    });

    it("counts a partial last chunk", () => {
      expect(chunkCount(0)).toBe(0);
      expect(chunkCount(257)).toBe(2);
    });
  });

  describe("invariants", () => {
    it("visits every chunk exactly once", () => {
      const chunks = Array.from({ length: 40 }, (_, i) => i);
      const order = drain(new Set(chunks), 17);
      expect(order.toSorted((a, b) => a - b)).toEqual(chunks);
    });
  });
});
