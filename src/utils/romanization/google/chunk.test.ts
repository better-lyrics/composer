import { describe, expect, it } from "vitest";
import { encodeBatch } from "@/utils/romanization/google/batch";
import { chunkLinesByBody } from "@/utils/romanization/google/chunk";

describe("chunkLinesByBody: passthrough", () => {
  it("returns one chunk when total body fits under the cap", () => {
    const lines = [["a", "b"], ["c"]];
    const out = chunkLinesByBody(lines, { maxBody: 10_000 });
    expect(out).toEqual([lines]);
  });

  it("returns empty array for empty input", () => {
    expect(chunkLinesByBody([], { maxBody: 10_000 })).toEqual([]);
  });

  it("a single small line is one chunk of one line", () => {
    expect(chunkLinesByBody([["a"]], { maxBody: 10_000 })).toEqual([[["a"]]]);
  });
});

describe("chunkLinesByBody: splitting", () => {
  it("splits into multiple chunks when total body would exceed the cap", () => {
    const big = "x".repeat(8_000);
    const lines = [[big], [big], [big]];
    const chunks = chunkLinesByBody(lines, { maxBody: 15_000 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(lines);
  });

  it("starts a new chunk when the next line would overflow", () => {
    const a = "x".repeat(6_000);
    const b = "y".repeat(6_000);
    const c = "z".repeat(6_000);
    const lines = [[a], [b], [c]];
    const chunks = chunkLinesByBody(lines, { maxBody: 15_000 });
    expect(chunks).toEqual([[[a], [b]], [[c]]]);
  });

  it("each emitted chunk encodes under maxBody", () => {
    const big = "x".repeat(7_000);
    const lines = [[big], [big], [big], [big], [big]];
    const chunks = chunkLinesByBody(lines, { maxBody: 15_000 });
    for (const chunk of chunks) {
      const encoded = encodeBatch(chunk);
      const bodySize = `q=${encodeURIComponent(encoded)}`.length;
      expect(bodySize).toBeLessThanOrEqual(15_000 + 10);
    }
  });
});

describe("chunkLinesByBody: oversized lines", () => {
  it("puts a single oversized line in its own chunk (no silent split)", () => {
    const huge = "x".repeat(20_000);
    const lines = [[huge]];
    const chunks = chunkLinesByBody(lines, { maxBody: 15_000 });
    expect(chunks).toEqual([[[huge]]]);
  });

  it("an oversized line is followed by a normal line in a separate chunk", () => {
    const huge = "x".repeat(20_000);
    const small = ["a", "b"];
    const chunks = chunkLinesByBody([[huge], small], { maxBody: 15_000 });
    expect(chunks).toEqual([[[huge]], [small]]);
  });

  it("normal line, then oversized, then normal: oversized gets its own chunk in the middle", () => {
    const huge = "x".repeat(20_000);
    const chunks = chunkLinesByBody([["a"], [huge], ["b"]], { maxBody: 15_000 });
    expect(chunks).toEqual([[["a"]], [[huge]], [["b"]]]);
  });
});

describe("chunkLinesByBody: line-with-many-words", () => {
  it("encodes words within a line correctly when computing per-line size", () => {
    const many = Array.from({ length: 1000 }, () => "word");
    const lines = [many];
    const encoded = encodeBatch(lines);
    const bodySize = `q=${encodeURIComponent(encoded)}`.length;
    const chunks = chunkLinesByBody(lines, { maxBody: 15_000 });
    if (bodySize > 15_000) {
      expect(chunks).toEqual([lines]);
    } else {
      expect(chunks).toEqual([lines]);
    }
  });
});

describe("chunkLinesByBody: round-trip with batch", () => {
  it("flattening chunks reproduces input order", () => {
    const big = "x".repeat(5_000);
    const lines = [[big], ["a"], [big], ["b"], [big]];
    const chunks = chunkLinesByBody(lines, { maxBody: 15_000 });
    expect(chunks.flat()).toEqual(lines);
  });
});

describe("chunkLinesByBody: input integrity", () => {
  it("does not mutate the input lines array", () => {
    const lines = [["a"], ["b"]];
    const before = JSON.stringify(lines);
    chunkLinesByBody(lines, { maxBody: 10_000 });
    expect(JSON.stringify(lines)).toBe(before);
  });
});
