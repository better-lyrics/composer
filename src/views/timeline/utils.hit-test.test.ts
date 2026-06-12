import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { computeRowLayout, getLineAndTrackAtY } from "@/views/timeline/utils";

const line = (id: string, words?: LyricLine["words"]): LyricLine =>
  ({ id, agentId: "a", text: id, words: words ?? [{ text: id, begin: 0, end: 1 }] }) as LyricLine;

describe("getLineAndTrackAtY", () => {
  const layout = computeRowLayout({
    lines: [line("l1"), line("l2")],
    rowHeights: {},
    defaultRowHeight: 40,
    collapsedInstances: {},
    waveformHeight: 100,
    bgDropZoneHeight: 24,
    groupHeaderHeight: 20,
  });
  const lines = [line("l1"), line("l2")];

  describe("happy paths", () => {
    it("returns word track for y inside main half of first row", () => {
      expect(getLineAndTrackAtY(120, lines, layout)).toEqual({ lineIndex: 0, track: "word" });
    });
    it("returns bg track for y inside bg drop zone of first row", () => {
      expect(getLineAndTrackAtY(150, lines, layout)).toEqual({ lineIndex: 0, track: "bg" });
    });
    it("returns word track for y inside main half of second row", () => {
      expect(getLineAndTrackAtY(180, lines, layout)).toEqual({ lineIndex: 1, track: "word" });
    });
  });

  describe("edge cases", () => {
    it("returns null for y above first row", () => {
      expect(getLineAndTrackAtY(50, lines, layout)).toBeNull();
    });
    it("returns null for y below last row", () => {
      expect(getLineAndTrackAtY(9999, lines, layout)).toBeNull();
    });
    it("returns word track exactly at the top edge of a row", () => {
      expect(getLineAndTrackAtY(100, lines, layout)?.track).toBe("word");
    });
    it("returns bg track exactly at mainBottom (y >= mainBottom is bg)", () => {
      expect(getLineAndTrackAtY(140, lines, layout)?.track).toBe("bg");
    });
  });

  describe("invariants", () => {
    it("each lineTop entry has mainBottom strictly between top and top+height", () => {
      for (const pos of layout.lineTops.values()) {
        expect(pos.mainBottom).toBeGreaterThan(pos.top);
        expect(pos.mainBottom).toBeLessThan(pos.top + pos.height);
      }
    });
  });

  describe("hit test boundaries", () => {
    const firstPos = layout.lineTops.get("l1");
    const secondPos = layout.lineTops.get("l2");
    if (!firstPos || !secondPos) throw new Error("missing layout positions");

    it("returns first row at y equal to top of first row", () => {
      expect(getLineAndTrackAtY(firstPos.top, lines, layout)).toEqual({ lineIndex: 0, track: "word" });
    });

    it("returns first row at the last pixel of the first row (top + height - 1)", () => {
      const y = firstPos.top + firstPos.height - 1;
      const hit = getLineAndTrackAtY(y, lines, layout);
      expect(hit?.lineIndex).toBe(0);
    });

    it("returns next row at y one past the bottom of the first row (top + height)", () => {
      const y = firstPos.top + firstPos.height;
      const hit = getLineAndTrackAtY(y, lines, layout);
      expect(hit).toEqual({ lineIndex: 1, track: "word" });
      expect(y).toBe(secondPos.top);
    });

    it("returns null at one past the last pixel of the last row", () => {
      const y = secondPos.top + secondPos.height;
      expect(getLineAndTrackAtY(y, lines, layout)).toBeNull();
    });

    it("returns word track at the last pixel of the main half (mainBottom - 1)", () => {
      const y = firstPos.mainBottom - 1;
      expect(getLineAndTrackAtY(y, lines, layout)).toEqual({ lineIndex: 0, track: "word" });
    });

    it("returns bg track exactly at mainBottom (the seam belongs to bg)", () => {
      const y = firstPos.mainBottom;
      expect(getLineAndTrackAtY(y, lines, layout)).toEqual({ lineIndex: 0, track: "bg" });
    });
  });
});
