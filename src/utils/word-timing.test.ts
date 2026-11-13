/**
 * @vitest-environment node
 */
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";
import { cloneWord, splitSourceWord, synthesizeBracketedWord } from "./word-timing";

describe("cloneWord", () => {
  it("carries every input field through, overrides apply", () => {
    const source: WordTiming = {
      id: "w1",
      text: "ev",
      sep: "",
      begin: 0,
      end: 0.3,
      explicit: true,
      joinsNext: true,
    };
    const result = cloneWord(source, { begin: 5, end: 5.3 });
    expect(result).toEqual({
      text: "ev",
      sep: "",
      begin: 5,
      end: 5.3,
      explicit: true,
      joinsNext: true,
    });
  });

  it("returns a fresh object (no aliasing)", () => {
    const source: WordTiming = { id: "w2", text: "ev", sep: "", begin: 0, end: 1, joinsNext: true };
    const result = cloneWord(source, {});
    expect(result).not.toBe(source);
    expect(result).toEqual(source);
  });
});

describe("synthesizeBracketedWord", () => {
  it("joins the next word when the caller says it does", () => {
    const result = synthesizeBracketedWord({ text: "e", sep: "", begin: 0, end: 0.1, joinsNext: true });
    expect(result.joinsNext).toBe(true);
  });

  it("ends the word when the caller says it does", () => {
    const result = synthesizeBracketedWord({ text: "e", sep: " ", begin: 0, end: 0.1, joinsNext: false });
    expect(result.joinsNext).toBe(false);
  });

  it("sets explicit when explicit=true is passed", () => {
    const result = synthesizeBracketedWord({ text: "e", sep: "", begin: 0, end: 0.1, explicit: true, joinsNext: true });
    expect(result.explicit).toBe(true);
  });

  it("omits explicit when explicit=false or absent", () => {
    const result = synthesizeBracketedWord({
      text: "e",
      sep: "",
      begin: 0,
      end: 0.1,
      explicit: false,
      joinsNext: true,
    });
    expect(result.explicit).toBeUndefined();
  });
});

describe("splitSourceWord", () => {
  it("returns N words, each inheriting source fields except text/begin/end", () => {
    const source: WordTiming = {
      id: "w13",
      text: "every",
      sep: "",
      begin: 0,
      end: 0.9,
      explicit: true,
      joinsNext: true,
    };
    const result = splitSourceWord(source, [
      { text: "ev", begin: 0, end: 0.3 },
      { text: "er", begin: 0.3, end: 0.6 },
      { text: "y", begin: 0.6, end: 0.9 },
    ]);
    expect(result).toHaveLength(3);
    for (const w of result) {
      expect(w.explicit).toBe(true);
      expect(w.joinsNext).toBe(true);
    }
    expect(result.map((w) => w.text)).toEqual(["ev", "er", "y"]);
    expect(result[0].begin).toBe(0);
    expect(result[2].end).toBe(0.9);
  });

  it("joins every piece of a standalone word but the last, which keeps the word's end", () => {
    const source: WordTiming = { id: "w17", text: "hello", sep: "", begin: 0, end: 1, joinsNext: false };
    const result = splitSourceWord(source, [
      { text: "hel", begin: 0, end: 0.5 },
      { text: "lo", begin: 0.5, end: 1 },
    ]);
    expect(result.map((w) => w.joinsNext)).toEqual([true, false]);
  });

  it("keeps the id on the first piece of a split and gives the others new ones", () => {
    const source: WordTiming = { id: "y5", text: "drifting", sep: "", begin: 4, end: 5, joinsNext: true };
    const pieces = splitSourceWord(source, [
      { text: "drif", begin: 4, end: 4.5 },
      { text: "ting", begin: 4.5, end: 5 },
    ]);
    expect(pieces[0].id).toBe("y5");
    expect(new Set(pieces.map((piece) => piece.id)).size).toBe(2);
  });
});
