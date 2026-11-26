import { alternateBackgroundPlacement } from "@/domain/language/background-placement";
import type { LyricLine } from "@/domain/line/model";
import { newWordId } from "@/domain/word/id";
import { describe, expect, it } from "vitest";

function timedLine(backgroundBegin: number, mainWords: NonNullable<LyricLine["words"]>): LyricLine {
  return {
    id: "line",
    agentId: "v1",
    text: "one two three",
    words: mainWords,
    backgroundText: "ooh",
    backgroundWords: [{ id: newWordId(), text: "ooh", sep: "", begin: backgroundBegin, end: backgroundBegin + 0.4 }],
  };
}

describe("alternateBackgroundPlacement", () => {
  it("places background content first when it starts before the foreground", () => {
    const line = timedLine(0.5, [
      { id: "w1", text: "one", sep: " ", begin: 1, end: 1.4 },
      { id: "w2", text: "two", sep: "", begin: 1.4, end: 2 },
    ]);

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "front" });
  });

  it("places background content in a foreground timing break it fits inside", () => {
    const line = timedLine(2.5, [
      { id: "w3", text: "one", sep: " ", begin: 1, end: 1.4 },
      { id: "w4", text: "two", sep: " ", begin: 2, end: 2.4 },
      { id: "w5", text: "three", sep: "", begin: 3, end: 3.4 },
    ]);

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "middle", afterWordIndex: 1 });
  });

  it("places background content at the end when it overlaps the foreground", () => {
    const line = timedLine(2.2, [
      { id: "w6", text: "one", sep: " ", begin: 1, end: 1.4 },
      { id: "w7", text: "two", sep: " ", begin: 2, end: 2.4 },
      { id: "w8", text: "three", sep: "", begin: 3, end: 3.4 },
    ]);

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "end" });
  });

  it("places background content at the end when it outlasts the timing break", () => {
    const line = timedLine(2.7, [
      { id: "w9", text: "one", sep: " ", begin: 1, end: 1.4 },
      { id: "w10", text: "two", sep: " ", begin: 2, end: 2.4 },
      { id: "w11", text: "three", sep: "", begin: 2.9, end: 3.4 },
    ]);

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "end" });
  });

  it("defaults to the end when the foreground has no timing break", () => {
    const line = timedLine(1.2, [
      { id: "w12", text: "one", sep: " ", begin: 1, end: 1.4 },
      { id: "w13", text: "two", sep: "", begin: 1.4, end: 2 },
    ]);

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "end" });
  });

  it("defaults to the end when alternate timing is unavailable", () => {
    const line = timedLine(1.2, [{ id: "w14", text: "one", sep: "", begin: 1, end: 2 }]);
    line.backgroundWords = undefined;

    expect(alternateBackgroundPlacement(line)).toEqual({ position: "end" });
  });
});
