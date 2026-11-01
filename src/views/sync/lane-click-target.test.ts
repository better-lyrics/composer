import { createLine } from "@/test/factories";
import { laneClickTarget } from "@/views/sync/lane-click-target";
import { describe, expect, it } from "vitest";

const partly = createLine({
  text: "a b c",
  words: [
    { text: "a ", begin: 1, end: 1.4 },
    { text: "b ", begin: 1.5, end: 2 },
  ],
});
const untimed = createLine({ text: "a b c" });
const lineSynced = createLine({ text: "a b c", begin: 1, end: 3 });

describe("laneClickTarget", () => {
  it("jumps to a word that has word timing", () => {
    expect(laneClickTarget(partly, 1, "word")).toEqual({ kind: "word", wordIndex: 1 });
  });

  it("jumps to the line from its first word when that word has no word timing", () => {
    expect(laneClickTarget(untimed, 0, "word")).toEqual({ kind: "line" });
    expect(laneClickTarget(lineSynced, 0, "word")).toEqual({ kind: "line" });
  });

  it("targets the whole line in line mode", () => {
    expect(laneClickTarget(partly, 2, "line")).toEqual({ kind: "line" });
  });

  describe("edge cases", () => {
    it("never targets an untimed word after the first, so a tap cannot drop the words before it", () => {
      expect(laneClickTarget(partly, 2, "word")).toBeNull();
      expect(laneClickTarget(untimed, 1, "word")).toBeNull();
      expect(laneClickTarget(lineSynced, 1, "word")).toBeNull();
    });
  });
});
