import { describe, expect, it } from "vitest";
import { type AnchorChain, anchorWindow, keepsAnchored, lastWord, withoutAnchor } from "@/domain/alignment/anchor";

// -- anchorWindow -------------------------------------------------------------

describe("anchorWindow", () => {
  const word = { parts: ["home"], begin: 9.2, end: 9.8 };
  const chain: AnchorChain = { lineId: "L1", word, cooling: false };
  const taps = { begin: 10, end: 12 };
  const plain = { begin: 9.4, end: 12.15 };

  it("starts 0.1 s before the previous line's last word and ends where the plain window does", () => {
    const window = anchorWindow(chain, "L1", taps, plain);
    expect(window?.begin).toBeCloseTo(9.1);
    expect(window?.end).toBe(12.15);
  });

  it("anchors only on the line just before, aligned in this run, whose own anchor held", () => {
    expect(anchorWindow(null, "L1", taps, plain)).toBeNull();
    expect(anchorWindow(chain, "L0", taps, plain)).toBeNull();
    expect(anchorWindow({ ...chain, cooling: true }, "L1", taps, plain)).toBeNull();
    expect(anchorWindow({ ...chain, word: null }, "L1", taps, plain)).toBeNull();
  });

  it("anchors only on a word just before the tap, with audio before it", () => {
    const at = (begin: number, end: number) =>
      anchorWindow({ ...chain, word: { ...word, begin, end } }, "L1", taps, plain);
    expect(at(8.6, 8.9)).toBeNull(); // a break of more than 1 s before the tap
    expect(at(8.4, 9.9)).toBeNull(); // started more than 1.5 s before the tap: a held note
    expect(at(10, 10.3)).toBeNull(); // not before the tap
    const early = { begin: 0.05, end: 0.5 };
    expect(anchorWindow({ ...chain, word: { ...word, ...early } }, "L1", { begin: 0.6, end: 2 }, plain)).toBeNull();
  });

  it("is capped like every window", () => {
    const window = anchorWindow(chain, "L1", { begin: 10, end: 80 }, { begin: 9.4, end: 80.15 });
    expect(window!.end - window!.begin).toBeCloseTo(15);
  });
});

// -- keepsAnchored ------------------------------------------------------------

describe("keepsAnchored", () => {
  const anchor = { parts: ["home"], begin: 9.2, end: 9.8 };
  const taps = { begin: 10, end: 12 };

  it("rejects an anchor the model moved more than 0.2 s, or a line starting more than 0.6 s before its tap", () => {
    expect(keepsAnchored(anchor, { begin: 9.39, end: 9.9 }, 9.9, taps)).toBe(true);
    expect(keepsAnchored(anchor, { begin: 9.45, end: 9.9 }, 9.9, taps)).toBe(false);
    expect(keepsAnchored(anchor, { begin: 9.2, end: 9.3 }, 9.35, taps)).toBe(false);
  });
});

// -- withoutAnchor and lastWord -----------------------------------------------

describe("withoutAnchor", () => {
  it("drops the anchor's parts and splits, and renumbers the line's splits", () => {
    const iv = (begin: number) => ({ begin, end: begin + 0.5 });
    const split = (part: number) => ({ part, at: [2], intervals: [iv(0), iv(0)] });
    const out = withoutAnchor({ intervals: [iv(0), iv(0.5), iv(1), iv(1.5)], splits: [split(1), split(3)] }, 2);
    expect(out.intervals).toEqual([iv(1), iv(1.5)]);
    expect(out.splits.map((s) => s.part)).toEqual([1]);
    expect(out.anchor).toEqual({ begin: 0, end: 1 });
  });
});

describe("lastWord", () => {
  it("is the line's last word as stored, across its parts, when it has something to pronounce", () => {
    const words = [
      { text: "hello", parts: ["hel", "lo"], trailingSpace: true },
      { text: "again", parts: ["a", "gain"], trailingSpace: false },
    ];
    const intervals = [1, 1.2, 1.5, 1.7].map((begin) => ({ begin, end: begin + 0.2 }));
    expect(lastWord(words, intervals)).toEqual({ parts: ["a", "gain"], begin: 1.5, end: 1.9 });
    expect(lastWord([{ text: "...", parts: ["..."], trailingSpace: false }], intervals.slice(0, 1))).toBeNull();
  });
});
