import { alternateBackgroundPlacement } from "@/domain/language/background-placement";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

function timedLine(backgroundBegin: number, mainWords: NonNullable<LyricLine["words"]>): LyricLine {
  return {
    id: "line",
    agentId: "v1",
    text: "one two three",
    words: mainWords,
    backgroundText: "ooh",
    backgroundWords: [{ text: "ooh", begin: backgroundBegin, end: backgroundBegin + 0.4 }],
  };
}

describe("alternateBackgroundPlacement", () => {
  it("places background content first when it starts before the foreground", () => {
    const line = timedLine(0.5, [
      { text: "one ", begin: 1, end: 1.4 },
      { text: "two", begin: 1.4, end: 2 },
    ]);

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "front" });
  });

  it("places background content in the closest foreground timing break", () => {
    const line = timedLine(2.7, [
      { text: "one ", begin: 1, end: 1.4 },
      { text: "two ", begin: 2, end: 2.4 },
      { text: "three", begin: 3, end: 3.4 },
    ]);

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "middle", afterWordIndex: 1 });
  });

  it("defaults to the end when the foreground has no timing break", () => {
    const line = timedLine(1.2, [
      { text: "one ", begin: 1, end: 1.4 },
      { text: "two", begin: 1.4, end: 2 },
    ]);

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "end" });
  });

  it("defaults to the end when alternate timing is unavailable", () => {
    const line = timedLine(1.2, [{ text: "one", begin: 1, end: 2 }]);
    line.backgroundWords = undefined;

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "end" });
  });
});
