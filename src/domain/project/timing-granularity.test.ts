import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { timingGranularityOf } from "@/domain/project/timing-granularity";

const wordSynced: LyricLine = {
  id: "w",
  text: "Hello world",
  agentId: "v1",
  words: [
    { text: "Hello ", begin: 1, end: 1.5 },
    { text: "world", begin: 1.5, end: 2 },
  ],
};
const lineSynced: LyricLine = { id: "l", text: "Line only", agentId: "v1", begin: 3, end: 4 };
const untimed: LyricLine = { id: "u", text: "Never synced", agentId: "v1" };

describe("timingGranularityOf", () => {
  describe("happy paths", () => {
    it("is word when any line carries word timing", () => {
      expect(timingGranularityOf([lineSynced, wordSynced])).toBe("word");
    });

    it("is line when no line carries word timing", () => {
      expect(timingGranularityOf([lineSynced, untimed])).toBe("line");
    });
  });

  describe("edge cases", () => {
    it("is line for an empty project", () => {
      expect(timingGranularityOf([])).toBe("line");
    });

    it("ignores background word timing on an otherwise line-synced line", () => {
      const withBackgroundWords: LyricLine = {
        ...lineSynced,
        backgroundText: "(yeah)",
        backgroundWords: [{ text: "(yeah)", begin: 3.5, end: 4 }],
      };
      expect(timingGranularityOf([withBackgroundWords])).toBe("line");
    });
  });

  describe("invariants", () => {
    it("does not depend on line order", () => {
      expect(timingGranularityOf([wordSynced, untimed, lineSynced])).toBe(
        timingGranularityOf([untimed, lineSynced, wordSynced]),
      );
    });
  });
});
