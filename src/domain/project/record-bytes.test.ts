import { estimateRecordBytes } from "@/domain/project/record-bytes";
import { describe, expect, it } from "vitest";

describe("estimateRecordBytes", () => {
  it("estimates size as the UTF-16 code units of the record's JSON", () => {
    const record = { metadata: { title: "Midnight City" }, lines: [{ id: "l1", text: "Waiting in a car" }] };
    expect(estimateRecordBytes(record)).toBe(JSON.stringify(record).length);
  });

  describe("edge cases", () => {
    it("estimates nothing for undefined", () => {
      expect(estimateRecordBytes(undefined)).toBe(0);
    });

    it("is a code-unit estimate, not a byte-accurate count, for non-Latin text", () => {
      expect(estimateRecordBytes({ title: "夜に駆ける" })).toBe(JSON.stringify({ title: "夜に駆ける" }).length);
    });
  });

  describe("invariants", () => {
    it("grows when the record grows", () => {
      expect(estimateRecordBytes({ lines: ["a", "b"] })).toBeGreaterThan(estimateRecordBytes({ lines: ["a"] }));
    });
  });
});
