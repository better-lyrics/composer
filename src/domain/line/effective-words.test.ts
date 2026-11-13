import { fieldsOfLine, type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import { mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { describe, expect, expectTypeOf, it } from "vitest";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import {
  effectiveMainWordEdit,
  effectiveTimingWrite,
  effectiveWordTextEdit,
  effectiveWords,
  getEffectiveLines,
} from "@/domain/line/effective-words";
import type { LyricLine, RawLine } from "@/domain/line/model";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { patchOf } from "@/test/field-updates";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LineFields> = {}): LyricLine {
  return lineFromFields({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- effectiveWords -----------------------------------------------------------

describe("effectiveWords", () => {
  it("returns the words array when word-synced", () => {
    const words = [
      { id: "w1", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w2", text: "world", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    expect(effectiveWords(line({ words }))).toEqual(words);
  });

  it("returns a single synthetic word covering line-synced begin/end", () => {
    expect(effectiveWords(line({ text: "Hello world", begin: 3, end: 7 }))).toEqual([
      { text: "Hello world", sep: "", begin: 3, end: 7, joinsNext: false },
    ]);
  });

  it("strips split characters from synthetic word text", () => {
    expect(effectiveWords(line({ text: "Hel|lo wo|rld", begin: 3, end: 7 }))).toEqual([
      { text: "Hello world", sep: "", begin: 3, end: 7, joinsNext: false },
    ]);
  });

  it("returns empty array when no timing at all", () => {
    expect(effectiveWords(line())).toEqual([]);
  });

  it("returns empty array for a word-synced line with an empty words array", () => {
    expect(effectiveWords(line({ words: [] }))).toEqual([]);
  });

  it("keeps the line-synced word id across a timing change", () => {
    const line = createLine({ id: "l7", text: "Into the quiet", begin: 1, end: 3 });
    const moved = lineFromFields({ ...fieldsOfLine(line), begin: 2, end: 4 });
    expect(effectiveWords(line)[0].id).toBeTruthy();
    expect(effectiveWords(moved)[0].id).toBe(effectiveWords(line)[0].id);
  });
});

// -- getEffectiveLines --------------------------------------------------------

describe("getEffectiveLines", () => {
  it("injects synthetic single-word array for line-synced lines", () => {
    const lines: LyricLine[] = [line({ id: "a", text: "Hi", begin: 1, end: 2 })];
    expect(timedSyllables(mainTrack(getEffectiveLines(lines)[0]))).toEqual([
      { text: "Hi", sep: "", begin: 1, end: 2, joinsNext: false },
    ]);
  });

  it("leaves word-synced lines untouched", () => {
    const words = [{ id: "w3", text: "Hi", sep: " ", begin: 0, end: 1, joinsNext: false }];
    const lines: LyricLine[] = [line({ words })];
    expect(timedSyllables(mainTrack(getEffectiveLines(lines)[0]))).toBe(timedSyllables(mainTrack(lines[0])));
  });

  it("leaves untimed lines untouched (no synthetic words)", () => {
    const lines: LyricLine[] = [line({ id: "a", text: "Hi" })];
    expect(roleWords(getEffectiveLines(lines)[0], "main")).toBeUndefined();
  });

  it("preserves other line properties", () => {
    const lines: LyricLine[] = [line({ id: "a", agentId: "v9", begin: 1, end: 2, groupId: "g1", instanceIdx: 3 })];
    const out = getEffectiveLines(lines)[0];
    expect(out.id).toBe("a");
    expect(mainTrack(out).agentId).toBe("v9");
    expect(out.groupId).toBe("g1");
    expect(out.instanceIdx).toBe(3);
  });
});

describe("getEffectiveLines timing source", () => {
  it("records where each effective line's words came from", () => {
    const [w, l, u] = getEffectiveLines([
      createLine({ id: "w", text: "a", words: [{ text: "a", begin: 1, end: 2 }] }),
      createLine({ id: "l", text: "Line synced", begin: 3, end: 5 }),
      createLine({ id: "u", text: "untimed" }),
    ]);
    expect([w.timingSource, l.timingSource, u.timingSource]).toEqual(["words", "line", "none"]);
    expect(timedSyllables(mainTrack(l))).toEqual([
      { text: "Line synced", sep: "", begin: 3, end: 5, joinsNext: false },
    ]);
  });

  it("invariant: keeps the effective line of every unchanged raw line, and only of those", () => {
    useSettingsStore.getState().set("splitCharacter", "|");
    const lines = [
      createLine({ id: "w", text: "Hel|lo", words: [{ text: "Hel|lo", begin: 1, end: 2 }] }),
      createLine({ id: "l", text: "Fa|ding", begin: 3, end: 5 }),
      line({
        id: "t",
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
      }),
    ];
    const before = getEffectiveLines(lines);
    const edited = [lines[0], lineFromFields({ ...fieldsOfLine(lines[1]), begin: 4 }), lines[2]];
    const after = getEffectiveLines(edited);

    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    expect(after[1]).not.toBe(before[1]);
    expect(after).toEqual(getEffectiveLines(structuredClone(edited)));

    useSettingsStore.getState().set("splitCharacter", "/");
    const resplit = getEffectiveLines(edited);
    useSettingsStore.getState().set("splitCharacter", "|");
    expect(resplit[1]).not.toBe(after[1]);
    expect(timedSyllables(mainTrack(resplit[1]))[0].text).toBe("Fading");
  });

  it("invariant: an EffectiveLine is not assignable to RawLine", () => {
    const [line] = getEffectiveLines([createLine({ text: "a" })]);
    expectTypeOf(line).not.toMatchTypeOf<RawLine>();
    expectTypeOf(createLine({ text: "a" })).toMatchTypeOf<RawLine>();
  });
});

describe("effectiveTimingWrite", () => {
  it("regression D7/[: a timing edit of a line-synced row writes begin/end, not words", () => {
    const [line] = getEffectiveLines([createLine({ text: "Line synced", begin: 3, end: 5 })]);
    expect(
      patchOf(
        effectiveTimingWrite(line, [{ id: "w3", text: "Line synced", sep: "", begin: 4, end: 6, joinsNext: false }]),
        line,
      ),
    ).toEqual({
      begin: 4,
      end: 6,
    });
  });

  it("writes words for a word-synced line and never writes text", () => {
    const [line] = getEffectiveLines([createLine({ text: "a b", words: [{ text: "a", sep: " ", begin: 1, end: 2 }] })]);
    const words = [{ id: "w5", text: "a", sep: " ", begin: 1.5, end: 2, joinsNext: false }];
    expect(patchOf(effectiveTimingWrite(line, words), line)).toEqual({ words });
  });

  it("accepts a raw line too", () => {
    const raw = createLine({ text: "x", begin: 1, end: 2 });
    expect(
      patchOf(effectiveTimingWrite(raw, [{ id: "w4", text: "x", sep: "", begin: 2, end: 3, joinsNext: false }]), raw),
    ).toEqual({
      begin: 2,
      end: 3,
    });
  });
});

describe("effectiveMainWordEdit", () => {
  it("keeps a line-synced row line-synced when a structural edit leaves one word", () => {
    const [line] = getEffectiveLines([createLine({ text: "Line synced", begin: 3, end: 5 })]);
    expect(
      patchOf(
        effectiveMainWordEdit(line, [{ id: "w5", text: "Line synced", sep: "", begin: 6, end: 8, joinsNext: false }]),
        line,
      ),
    ).toEqual({
      begin: 6,
      end: 8,
    });
  });

  it("regression Alt-duplicate: rejects a structural edit that would give a line-synced row two words", () => {
    const [line] = getEffectiveLines([createLine({ text: "L", begin: 3, end: 5 })]);
    expect(
      effectiveMainWordEdit(line, [
        { id: "w6", text: "L", sep: " ", begin: 3, end: 5, joinsNext: false },
        { id: "w7", text: "L", sep: "", begin: 6, end: 8, joinsNext: false },
      ]),
    ).toBeNull();
  });

  it("regression #213: converts a line-synced row to words when the caller opts in", () => {
    const [line] = getEffectiveLines([createLine({ text: "It hurts", begin: 3, end: 5 })]);
    const words = [
      { id: "w8", text: "It hurts", sep: " ", begin: 3, end: 5, joinsNext: false },
      { id: "w9", text: "never", sep: "", begin: 6, end: 7, joinsNext: false },
    ];
    expect(patchOf(effectiveMainWordEdit(line, words, { convertLineSynced: true }), line)).toEqual({
      words,
      text: "It hurts never",
    });
  });

  it("converting leaves a word-synced line on the normal word edit", () => {
    const [line] = getEffectiveLines([createLine({ text: "a", words: [{ text: "a", begin: 1, end: 2 }] })]);
    const words = [
      { id: "w10", text: "a", sep: " ", begin: 1, end: 2, joinsNext: false },
      { id: "w11", text: "b", sep: "", begin: 2, end: 3, joinsNext: false },
    ];
    expect(patchOf(effectiveMainWordEdit(line, words, { convertLineSynced: true }), line)).toEqual({
      words,
      text: "a b",
    });
  });

  it("re-derives text for a word-synced line", () => {
    const [line] = getEffectiveLines([
      createLine({
        text: "a b",
        words: [
          { text: "a", sep: " ", begin: 1, end: 2 },
          { text: "b", begin: 2, end: 3 },
        ],
      }),
    ]);
    const reordered = [
      { id: "w12", text: "b", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w13", text: "a", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    expect(patchOf(effectiveMainWordEdit(line, reordered), line)).toEqual({ words: reordered, text: "b a" });
  });
});

describe("effectiveWordTextEdit", () => {
  it("regression: renaming the word of a line-synced row updates text and keeps it line-synced", () => {
    const [line] = getEffectiveLines([createLine({ text: "Old", begin: 3, end: 5 })]);
    expect(
      patchOf(
        effectiveWordTextEdit(line, [{ id: "w6", text: "New words", sep: "", begin: 3, end: 5, joinsNext: false }]),
        line,
      ),
    ).toEqual({
      text: "New words",
    });
  });

  it("writes words for a word-synced line", () => {
    const [line] = getEffectiveLines([createLine({ text: "a b", words: [{ text: "a", sep: " ", begin: 1, end: 2 }] })]);
    const words = [{ id: "w14", text: "z", sep: " ", begin: 1, end: 2, joinsNext: false }];
    expect(patchOf(effectiveWordTextEdit(line, words), line)).toEqual({ words, text: "z b" });
  });

  it("writes words for a raw line with no timing", () => {
    const words = [{ id: "w15", text: "z", sep: "", begin: 1, end: 2, joinsNext: false }];
    const raw = createLine({ text: "a" });
    expect(patchOf(effectiveWordTextEdit(raw, words), raw)).toEqual({ words, text: "za" });
  });

  it("accepts a raw line-synced line", () => {
    const raw = createLine({ text: "Old", begin: 3, end: 5 });
    expect(
      patchOf(
        effectiveWordTextEdit(raw, [{ id: "w7", text: "New", sep: "", begin: 3, end: 5, joinsNext: false }]),
        raw,
      ),
    ).toEqual({ text: "New" });
  });
});
