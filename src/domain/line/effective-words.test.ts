import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import { effectiveWords, getEffectiveLines } from "@/domain/line/effective-words";
import { bgText, bgVoice, bgWords, mainVoice, mainWords } from "@/domain/line/voices";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { setBackground } from "@/domain/line/background";
import { isLineSynced, isWordSynced } from "@/domain/voice/predicates";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- effectiveWords -----------------------------------------------------------

describe("effectiveWords", () => {
  it("returns the words array when word-synced", () => {
    const words = [
      { text: "Hello ", begin: 0, end: 1 },
      { text: "world", begin: 1, end: 2 },
    ];
    expect(effectiveWords(line({ words }))).toEqual(words);
  });

  it("returns a single synthetic word covering line-synced begin/end", () => {
    expect(effectiveWords(line({ text: "Hello world", begin: 3, end: 7 }))).toEqual([
      { text: "Hello world", begin: 3, end: 7 },
    ]);
  });

  it("strips split characters from synthetic word text", () => {
    expect(effectiveWords(line({ text: "Hel|lo wo|rld", begin: 3, end: 7 }))).toEqual([
      { text: "Hello world", begin: 3, end: 7 },
    ]);
  });

  it("returns empty array when no timing at all", () => {
    expect(effectiveWords(line())).toEqual([]);
  });

  it("returns empty array for a word-synced line with an empty words array", () => {
    expect(effectiveWords(line({ words: [] }))).toEqual([]);
  });
});

// -- getEffectiveLines --------------------------------------------------------

describe("getEffectiveLines", () => {
  it("injects synthetic single-word array for line-synced lines", () => {
    const lines: LyricLine[] = [line({ id: "a", text: "Hi", begin: 1, end: 2 })];
    expect(mainWords(getEffectiveLines(lines)[0])).toEqual([{ text: "Hi", begin: 1, end: 2 }]);
  });

  it("leaves word-synced lines untouched", () => {
    const words = [{ text: "Hi ", begin: 0, end: 1 }];
    const lines: LyricLine[] = [line({ words })];
    expect(mainWords(getEffectiveLines(lines)[0])).toBe(words);
  });

  it("leaves untimed lines untouched (no synthetic words)", () => {
    const lines: LyricLine[] = [line({ id: "a", text: "Hi" })];
    expect(mainWords(getEffectiveLines(lines)[0])).toBeUndefined();
  });

  it("preserves other line properties", () => {
    const lines: LyricLine[] = [line({ id: "a", agentId: "v9", begin: 1, end: 2, groupId: "g1", instanceIdx: 3 })];
    const out = getEffectiveLines(lines)[0];
    expect(out.id).toBe("a");
    expect(out.agentId).toBe("v9");
    expect(out.groupId).toBe("g1");
    expect(out.instanceIdx).toBe(3);
  });
});

// -- background preservation through the line-synced-main conversion ----------

describe("getEffectiveLines: background preservation", () => {
  it("keeps a line-synced background line-synced while converting a line-synced main", () => {
    const input = setBackground(line({ id: "a", text: "Main", begin: 1, end: 4 }), {
      text: "Oooh",
      begin: 1.5,
      end: 3.5,
      source: "manual",
    });
    const originalBgBounds = bgBounds(input);

    const out = getEffectiveLines([input])[0];

    expect(mainWords(out)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(isWordSynced(mainVoice(out))).toBe(true);

    expect(bgWords(out)).toBeUndefined();
    expect(bgBounds(out)).toEqual(originalBgBounds);
    expect(bgText(out)).toBe("Oooh");
    const bg = bgVoice(out);
    expect(bg).not.toBeNull();
    if (bg !== null) expect(isLineSynced(bg)).toBe(true);
  });

  it("keeps a word-synced background word-synced verbatim", () => {
    const bgWordsArr = [
      { text: "Oo ", begin: 1.5, end: 2 },
      { text: "ooh", begin: 2, end: 3 },
    ];
    const input = setBackground(line({ id: "a", text: "Main", begin: 1, end: 4 }), {
      text: "Oo ooh",
      words: bgWordsArr,
      source: "manual",
    });

    const out = getEffectiveLines([input])[0];

    expect(isWordSynced(mainVoice(out))).toBe(true);
    expect(bgWords(out)).toEqual(bgWordsArr);
    const bg = bgVoice(out);
    expect(bg).not.toBeNull();
    if (bg !== null) expect(isWordSynced(bg)).toBe(true);
  });

  it("keeps an untimed background untimed", () => {
    const input = setBackground(line({ id: "a", text: "Main", begin: 1, end: 4 }), {
      text: "Oooh",
      source: "manual",
    });

    const out = getEffectiveLines([input])[0];

    expect(isWordSynced(mainVoice(out))).toBe(true);
    expect(bgWords(out)).toBeUndefined();
    expect(bgBounds(out)).toBeNull();
    expect(bgText(out)).toBe("Oooh");
  });

  it("returns a word-synced-main line with a line-synced background verbatim", () => {
    const words = [{ text: "Main", begin: 1, end: 4 }];
    const input = setBackground(line({ id: "a", text: "Main", words }), {
      text: "Oooh",
      begin: 1.5,
      end: 3.5,
      source: "manual",
    });

    const out = getEffectiveLines([input])[0];

    expect(out).toBe(input);
    expect(bgWords(out)).toBeUndefined();
    expect(bgBounds(out)).toEqual({ begin: 1.5, end: 3.5 });
  });

  it("produces no background key when the line has no background", () => {
    const input = line({ id: "a", text: "Main", begin: 1, end: 4 });

    const out = getEffectiveLines([input])[0];

    expect(isWordSynced(mainVoice(out))).toBe(true);
    expect("background" in out).toBe(false);
  });

  describe("invariants", () => {
    it("does not mutate the input line", () => {
      const input = setBackground(line({ id: "a", text: "Main", begin: 1, end: 4 }), {
        text: "Oooh",
        begin: 1.5,
        end: 3.5,
        source: "manual",
      });
      const snapshotMainBounds = mainBounds(input);
      const snapshotBgBounds = bgBounds(input);

      getEffectiveLines([input]);

      expect(isLineSynced(mainVoice(input))).toBe(true);
      expect(mainBounds(input)).toEqual(snapshotMainBounds);
      expect(bgBounds(input)).toEqual(snapshotBgBounds);
      const bg = bgVoice(input);
      expect(bg).not.toBeNull();
      if (bg !== null) expect(isLineSynced(bg)).toBe(true);
    });
  });
});
