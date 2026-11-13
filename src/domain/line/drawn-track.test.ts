import { describe, expect, it } from "vitest";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { drawnPieces, drawnSyllables } from "@/domain/line/drawn-track";
import { fieldsOfLine, type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { mainTimingEdit, mainTimingWrite } from "@/domain/line/track-writes";
import { lineTimingWordId } from "@/domain/word/id";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { patchOf } from "@/test/field-updates";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LineFields> = {}): LyricLine {
  return lineFromFields({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- drawnSyllables -----------------------------------------------------------

describe("drawnSyllables", () => {
  it("returns the timed syllables of a word-synced line", () => {
    const words = [
      { id: "w1", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w2", text: "world", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    const synced = line({ words });
    expect(drawnSyllables(synced, "main")).toEqual(words);
    expect(drawnSyllables(synced, "main")).toBe(timedSyllables(mainTrack(synced)));
  });

  it("draws a line-synced line as one block over its span", () => {
    expect(drawnSyllables(line({ text: "Hello world", begin: 3, end: 7 }), "main")).toEqual([
      { id: lineTimingWordId("l1"), text: "Hello world", sep: "", begin: 3, end: 7, joinsNext: false },
    ]);
  });

  it("strips split characters from the block text", () => {
    expect(drawnSyllables(line({ text: "Hel|lo wo|rld", begin: 3, end: 7 }), "main")[0].text).toBe("Hello world");
  });

  it("draws nothing for an untimed line", () => {
    expect(drawnSyllables(line(), "main")).toEqual([]);
    expect(drawnSyllables(line({ words: [] }), "main")).toEqual([]);
  });

  it("keeps the block id across a timing change", () => {
    const synced = createLine({ id: "l7", text: "Into the quiet", begin: 1, end: 3 });
    const moved = lineFromFields({ ...fieldsOfLine(synced), begin: 2, end: 4 });
    expect(drawnSyllables(moved, "main")[0].id).toBe(drawnSyllables(synced, "main")[0].id);
  });

  it("invariant: the same track and split character give the same array, and only those", () => {
    useSettingsStore.getState().set("splitCharacter", "|");
    const synced = createLine({ id: "l", text: "Fa|ding", begin: 3, end: 5 });
    const before = drawnSyllables(synced, "main");
    expect(drawnSyllables(synced, "main")).toBe(before);
    expect(drawnSyllables(lineFromFields({ ...fieldsOfLine(synced), begin: 4 }), "main")).not.toBe(before);

    useSettingsStore.getState().set("splitCharacter", "/");
    const resplit = drawnSyllables(synced, "main");
    useSettingsStore.getState().set("splitCharacter", "|");
    expect(resplit).not.toBe(before);
  });
});

// -- drawnPieces --------------------------------------------------------------

describe("drawnPieces", () => {
  it("reads the romanization aligned to the drawn syllables", () => {
    const romanized = line({
      text: "Привет",
      words: [{ id: "w4", text: "Привет", sep: "", begin: 6, end: 7, joinsNext: false }],
      languages: {
        transliteration: {
          language: "ru-Latn",
          main: { text: "privet", segments: [] },
          origin: "manual",
          sourceFingerprint: languageSourceFingerprint("Привет"),
        },
      },
    });
    expect(drawnPieces(romanized, "main")?.w4?.text).toBe("privet");
    expect(drawnPieces(romanized, "main")).toBe(drawnPieces(romanized, "main"));
  });
});

// -- Timing writes ------------------------------------------------------------

describe("mainTimingWrite", () => {
  it("regression D7/[: a timing edit of a line-synced row writes begin/end, not words", () => {
    const synced = createLine({ text: "Line synced", begin: 3, end: 5 });
    const [block] = drawnSyllables(synced, "main");
    expect(patchOf(mainTimingWrite(synced, [{ ...block, begin: 4, end: 6 }]), synced)).toEqual({ begin: 4, end: 6 });
  });

  it("writes words for a word-synced line and never writes text", () => {
    const synced = createLine({ text: "a b", words: [{ text: "a", sep: " ", begin: 1, end: 2 }] });
    const words = [{ id: "w5", text: "a", sep: " ", begin: 1.5, end: 2, joinsNext: false }];
    expect(patchOf(mainTimingWrite(synced, words), synced)).toEqual({ words });
  });
});

describe("mainTimingEdit", () => {
  it("keeps a line-synced row line-synced when an edit leaves one block", () => {
    const synced = createLine({ text: "Line synced", begin: 3, end: 5 });
    const [block] = drawnSyllables(synced, "main");
    expect(patchOf(mainTimingEdit(synced, [{ ...block, begin: 6, end: 8 }]), synced)).toEqual({ begin: 6, end: 8 });
  });

  it("regression Alt-duplicate: refuses an edit that would give a line-synced row two words", () => {
    const synced = createLine({ text: "L", begin: 3, end: 5 });
    expect(
      mainTimingEdit(synced, [
        { id: "w6", text: "L", sep: " ", begin: 3, end: 5, joinsNext: false },
        { id: "w7", text: "L", sep: "", begin: 6, end: 8, joinsNext: false },
      ]),
    ).toBeNull();
  });

  it("re-derives text for a word-synced line", () => {
    const synced = createLine({
      text: "a b",
      words: [
        { text: "a", sep: " ", begin: 1, end: 2 },
        { text: "b", begin: 2, end: 3 },
      ],
    });
    const reordered = [
      { id: "w12", text: "b", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w13", text: "a", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    expect(patchOf(mainTimingEdit(synced, reordered), synced)).toEqual({ words: reordered, text: "b a" });
  });
});
