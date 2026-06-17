import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import type { WordTiming } from "@/domain/word/timing";
import { bgSource, bgText, bgVoice, bgWords, lineText, mainVoice, mainWords } from "@/domain/line/voices";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- mainVoice ----------------------------------------------------------------

describe("mainVoice", () => {
  describe("happy paths", () => {
    it("returns a word-synced voice for a word-synced line", () => {
      const words: WordTiming[] = [
        { text: "hel", begin: 1, end: 2 },
        { text: "lo", begin: 2, end: 3 },
      ];
      const voice = mainVoice(line({ words }));
      expect(voice).toEqual({ text: "Hello", words });
    });

    it("carries the words array by reference, not a copy", () => {
      const words: WordTiming[] = [{ text: "hi", begin: 1, end: 2 }];
      const voice = mainVoice(line({ words }));
      if (!("words" in voice)) throw new Error("expected word-synced voice");
      expect(voice.words).toBe(words);
    });

    it("returns a line-synced voice for a line-synced line", () => {
      const voice = mainVoice(line({ begin: 3, end: 7 }));
      expect(voice).toEqual({ text: "Hello", begin: 3, end: 7 });
    });

    it("returns an untimed voice for a line with no timing", () => {
      const voice = mainVoice(line());
      expect(voice).toEqual({ text: "Hello" });
    });
  });

  describe("edge cases", () => {
    it("returns an untimed voice with no begin or words keys", () => {
      const voice = mainVoice(line());
      expect("begin" in voice).toBe(false);
      expect("end" in voice).toBe(false);
      expect("words" in voice).toBe(false);
    });

    it("treats an empty-text line as untimed (text preserved verbatim)", () => {
      const voice = mainVoice(line({ text: "" }));
      expect(voice).toEqual({ text: "" });
    });

    it("treats begin: 0 as line-synced (guards against falsy-begin bug)", () => {
      const voice = mainVoice(line({ begin: 0, end: 1 }));
      expect(voice).toEqual({ text: "Hello", begin: 0, end: 1 });
    });

    it("treats an empty words array as untimed, matching ?.length falsiness", () => {
      const voice = mainVoice(line({ words: [] }));
      expect(voice).toEqual({ text: "Hello" });
      expect("words" in voice).toBe(false);
    });

    it("prefers words over stale begin/end (regression: TTML import populates both)", () => {
      const words: WordTiming[] = [{ text: "a", begin: 2, end: 5 }];
      const voice = mainVoice(line({ begin: 0, end: 999, words }));
      expect(voice).toEqual({ text: "Hello", words });
      if (!("words" in voice)) throw new Error("expected word-synced voice");
      expect(voice.words).toBe(words);
    });

    it("preserves unicode text verbatim", () => {
      const voice = mainVoice(line({ text: "안녕 🎵", begin: 2, end: 4 }));
      expect(voice).toEqual({ text: "안녕 🎵", begin: 2, end: 4 });
    });
  });
});

// -- bgVoice ------------------------------------------------------------------

describe("bgVoice", () => {
  describe("happy paths", () => {
    it("returns a word-synced background voice with words and source", () => {
      const backgroundWords: WordTiming[] = [
        { text: "ah", begin: 6, end: 9 },
        { text: "oh", begin: 9, end: 12 },
      ];
      const voice = bgVoice(line({ backgroundText: "ah oh", backgroundWords, backgroundTextSource: "extraction" }));
      expect(voice).toEqual({ text: "ah oh", words: backgroundWords, source: "extraction" });
    });

    it("carries the background words array by reference, not a copy", () => {
      const backgroundWords: WordTiming[] = [{ text: "ah", begin: 6, end: 9 }];
      const voice = bgVoice(line({ backgroundText: "ah", backgroundWords }));
      if (voice === null || !("words" in voice)) throw new Error("expected word-synced bg voice");
      expect(voice.words).toBe(backgroundWords);
    });

    it("returns an untimed background voice when only backgroundText is set", () => {
      const voice = bgVoice(line({ backgroundText: "ah", backgroundTextSource: "manual" }));
      expect(voice).toEqual({ text: "ah", source: "manual" });
    });

    it("returns null when the line has no background content at all", () => {
      expect(bgVoice(line())).toBeNull();
    });
  });

  describe("background words present without backgroundText", () => {
    it("returns a word-synced bg voice with empty text when only backgroundWords are set", () => {
      const backgroundWords: WordTiming[] = [
        { text: "ah", begin: 6, end: 9 },
        { text: "oh", begin: 9, end: 12 },
      ];
      const voice = bgVoice(line({ backgroundWords }));
      expect(voice).toEqual({ text: "", words: backgroundWords, source: undefined });
      if (voice === null || !("words" in voice)) throw new Error("expected word-synced bg voice");
      expect(voice.words).toBe(backgroundWords);
    });

    it("carries the source verbatim when only backgroundWords are set", () => {
      const backgroundWords: WordTiming[] = [{ text: "ah", begin: 6, end: 9 }];
      const voice = bgVoice(line({ backgroundWords, backgroundTextSource: "manual" }));
      expect(voice).toEqual({ text: "", words: backgroundWords, source: "manual" });
    });

    it("returns null when backgroundWords is empty and there is no backgroundText", () => {
      expect(bgVoice(line({ backgroundWords: [] }))).toBeNull();
    });
  });

  describe("source passthrough", () => {
    it("carries the extraction source verbatim", () => {
      const voice = bgVoice(line({ backgroundText: "ah", backgroundTextSource: "extraction" }));
      expect(voice).toEqual({ text: "ah", source: "extraction" });
    });

    it("carries the manual source verbatim", () => {
      const voice = bgVoice(line({ backgroundText: "ah", backgroundTextSource: "manual" }));
      expect(voice).toEqual({ text: "ah", source: "manual" });
    });

    it("carries an undefined source verbatim", () => {
      const voice = bgVoice(line({ backgroundText: "ah" }));
      expect(voice).toEqual({ text: "ah", source: undefined });
    });
  });

  describe("edge cases", () => {
    it("returns a voice (not null) for an empty-string backgroundText", () => {
      const voice = bgVoice(line({ backgroundText: "" }));
      expect(voice).not.toBeNull();
      expect(voice).toEqual({ text: "", source: undefined });
    });

    it("treats an empty backgroundWords array as untimed (no words key)", () => {
      const voice = bgVoice(line({ backgroundText: "ah", backgroundWords: [] }));
      expect(voice).toEqual({ text: "ah", source: undefined });
      if (voice === null) throw new Error("expected a voice");
      expect("words" in voice).toBe(false);
    });

    it("returns a word-synced bg voice even when main line is untimed", () => {
      const backgroundWords: WordTiming[] = [{ text: "ah", begin: 6, end: 9 }];
      const voice = bgVoice(line({ backgroundText: "ah", backgroundWords }));
      expect(voice).toEqual({ text: "ah", words: backgroundWords, source: undefined });
    });

    it("preserves unicode backgroundText verbatim", () => {
      const voice = bgVoice(line({ backgroundText: "안녕 🎵" }));
      expect(voice).toEqual({ text: "안녕 🎵", source: undefined });
    });
  });
});

// -- lineText -----------------------------------------------------------------

describe("lineText", () => {
  it("returns the text of a word-synced line", () => {
    expect(lineText(line({ words: [{ text: "Hello", begin: 1, end: 2 }] }))).toBe("Hello");
  });

  it("returns the text of a line-synced line", () => {
    expect(lineText(line({ begin: 3, end: 7 }))).toBe("Hello");
  });

  it("returns the text of an untimed line", () => {
    expect(lineText(line())).toBe("Hello");
  });

  it("returns empty string for an empty-text line", () => {
    expect(lineText(line({ text: "" }))).toBe("");
  });

  it("preserves unicode text verbatim", () => {
    expect(lineText(line({ text: "안녕 🎵" }))).toBe("안녕 🎵");
  });

  it("agrees with mainVoice(line).text across variants", () => {
    const cases: LyricLine[] = [
      line(),
      line({ begin: 1, end: 2 }),
      line({ words: [{ text: "Hello", begin: 1, end: 2 }] }),
      line({ text: "" }),
    ];
    for (const l of cases) {
      expect(lineText(l)).toBe(mainVoice(l).text);
    }
  });
});

// -- mainWords ----------------------------------------------------------------

describe("mainWords", () => {
  it("returns the word array of a word-synced line by reference", () => {
    const words: WordTiming[] = [{ text: "Hello", begin: 1, end: 2 }];
    expect(mainWords(line({ words }))).toBe(words);
  });

  it("returns undefined for a line-synced line", () => {
    expect(mainWords(line({ begin: 1, end: 2 }))).toBeUndefined();
  });

  it("returns undefined for an untimed line", () => {
    expect(mainWords(line())).toBeUndefined();
  });
});

// -- bgWords ------------------------------------------------------------------

describe("bgWords", () => {
  it("returns the background word array by reference", () => {
    const backgroundWords: WordTiming[] = [{ text: "ah", begin: 1, end: 2 }];
    expect(bgWords(line({ backgroundText: "ah", backgroundWords }))).toBe(backgroundWords);
  });

  it("returns undefined when there is no background", () => {
    expect(bgWords(line())).toBeUndefined();
  });

  it("returns undefined for a text-only background", () => {
    expect(bgWords(line({ backgroundText: "ah" }))).toBeUndefined();
  });
});

// -- bgText -------------------------------------------------------------------

describe("bgText", () => {
  it("returns the authored background text", () => {
    expect(bgText(line({ backgroundText: "ah" }))).toBe("ah");
  });

  it("returns undefined when there is no background text", () => {
    expect(bgText(line())).toBeUndefined();
  });

  it("returns undefined for a word-only background (unlike bgVoice which normalises to empty string)", () => {
    const backgroundWords: WordTiming[] = [{ text: "ah", begin: 1, end: 2 }];
    expect(bgText(line({ backgroundWords }))).toBeUndefined();
    expect(bgVoice(line({ backgroundWords }))?.text).toBe("");
  });
});

// -- bgSource -----------------------------------------------------------------

describe("bgSource", () => {
  it("returns the provenance flag", () => {
    expect(bgSource(line({ backgroundText: "ah", backgroundTextSource: "manual" }))).toBe("manual");
    expect(bgSource(line({ backgroundText: "ah", backgroundTextSource: "extraction" }))).toBe("extraction");
  });

  it("returns undefined when there is no background", () => {
    expect(bgSource(line())).toBeUndefined();
  });
});
