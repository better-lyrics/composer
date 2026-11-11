import { playingLineIndex } from "@/domain/line/playing-line";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

describe("playingLineIndex", () => {
  it("finds the sounding line, else the last line that ended, else the first line ahead, skipping untimed lines", () => {
    const lines = [
      createLine({ text: "untimed intro" }),
      createLine({ text: "first", begin: 2, end: 4 }),
      createLine({ text: "duet", begin: 5, end: 9 }),
      createLine({ text: "overlap", begin: 6, end: 7 }),
      createLine({ text: "untimed bridge" }),
      createLine({ text: "early outro", begin: 3, end: 3.5 }),
      createLine({ text: "last", begin: 10, end: 12 }),
    ];
    expect(playingLineIndex(lines, 0)).toBe(1);
    expect(playingLineIndex(lines, 2)).toBe(1);
    expect(playingLineIndex(lines, 3.2)).toBe(1);
    expect(playingLineIndex(lines, 4.5)).toBe(5);
    expect(playingLineIndex(lines, 6.5)).toBe(2);
    expect(playingLineIndex(lines, 9.5)).toBe(5);
    expect(playingLineIndex(lines, 11)).toBe(6);
    expect(playingLineIndex(lines, 20)).toBe(6);
    expect(playingLineIndex([createLine({ text: "untimed" })], 1)).toBe(-1);
  });
});
