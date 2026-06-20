import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { bgSource, bgText, bgVoice, bgWords, lineText, mainWords } from "@/domain/line/voices";
import { isLineSynced, isWordSynced } from "@/domain/voice/predicates";
import { parseLyricsFile } from "@/utils/lyrics-parsers";

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/ttml");
const ttmlFixture = (name: string) => readFileSync(resolve(FIXTURE_DIR, `${name}.ttml`), "utf-8");

describe("parseLyricsFile - TTML with undeclared namespaces (AMLL)", () => {
  it("parses an AMLL export that uses <amll:meta> without declaring xmlns:amll", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word"><head><metadata><ttm:agent type="person" xml:id="v1"/><amll:meta key="musicName" value="It Aint Nun"/><amll:meta key="artists" value="CHRIST DILLINGER, Acid Souljah"/><amll:meta key="album" value="It Aint Nun"/></metadata></head><body dur="04:29.370"><div begin="00:01.277" end="04:24.060"><p begin="00:01.277" end="00:02.621" ttm:agent="v1" itunes:key="L1"><span begin="00:01.277" end="00:01.480">Hell</span> <span begin="00:01.480" end="00:01.676">no,</span> <span begin="00:01.676" end="00:01.823">I</span> <span begin="00:01.823" end="00:02.075">can't</span> <span begin="00:02.075" end="00:02.257">be</span> <span begin="00:02.257" end="00:02.411">your</span> <span begin="00:02.411" end="00:02.621">man</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);

    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.hasTimingData).toBe(true);

    const firstLine = result.lines[0];
    expect(mainWords(firstLine)).toBeDefined();
    expect(mainWords(firstLine)?.length).toBe(7);
    expect(mainWords(firstLine)?.[0].text).toBe("Hell ");
    expect(mainWords(firstLine)?.[0].begin).toBeCloseTo(1.277, 3);
    expect(mainWords(firstLine)?.[6].text).toBe("man");
    expect(mainWords(firstLine)?.[6].end).toBeCloseTo(2.621, 3);
    expect(lineText(firstLine)).toBe("Hell no, I can't be your man");
  });

  it("does not leak <amll:meta> content into lyrics text", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><amll:meta key="musicName" value="LEAKED_TITLE"/><amll:meta key="artists" value="LEAKED_ARTIST"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1"><span begin="00:01.000" end="00:02.000">Hello</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);

    expect(result.lines).toHaveLength(1);
    expect(lineText(result.lines[0])).toBe("Hello");
    expect(lineText(result.lines[0])).not.toContain("LEAKED_TITLE");
    expect(lineText(result.lines[0])).not.toContain("LEAKED_ARTIST");
  });

  it("parses well-formed TTML identically (regression guard)", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1"><span begin="00:01.000" end="00:01.500">Hello</span> <span begin="00:01.500" end="00:02.000">world</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);

    expect(result.lines).toHaveLength(1);
    expect(lineText(result.lines[0])).toBe("Hello world");
    expect(mainWords(result.lines[0])).toHaveLength(2);
    expect(mainWords(result.lines[0])?.[0].begin).toBeCloseTo(1.0, 3);
    expect(mainWords(result.lines[0])?.[1].end).toBeCloseTo(2.0, 3);
  });

  it("tolerates an undeclared prefix used only in an attribute", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1" custom:flag="x"><span begin="00:01.000" end="00:02.000">Hello</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);

    expect(result.lines).toHaveLength(1);
    expect(lineText(result.lines[0])).toBe("Hello");
  });
});

describe("parseLyricsFile - TTML word explicit attribute", () => {
  it('recognizes amll:obscene="true" on a word span', () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:44.055" end="00:45.861" ttm:agent="v1"><span begin="00:44.055" end="00:44.192">Bot</span> <span begin="00:44.192" end="00:44.370">tom</span> <span begin="00:44.370" end="00:44.601">lip</span> <span begin="00:44.601" end="00:44.832" amll:obscene="true">curlin'</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);
    const words = mainWords(result.lines[0])!;
    expect(words[0].explicit).toBeUndefined();
    expect(words[3].text).toBe("curlin'");
    expect(words[3].explicit).toBe(true);
  });

  it('recognizes composer:explicit="true" on a word span', () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:composer="https://composer.boidu.dev/ttml"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1"><span begin="00:01.000" end="00:01.500">clean</span> <span begin="00:01.500" end="00:02.000" composer:explicit="true">dirty</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);
    const words = mainWords(result.lines[0])!;
    expect(words[0].explicit).toBeUndefined();
    expect(words[1].explicit).toBe(true);
  });

  it("recognizes an unprefixed obscene attribute", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1"><span begin="00:01.000" end="00:02.000" obscene="1">dirty</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);
    expect(mainWords(result.lines[0])![0].explicit).toBe(true);
  });

  it('treats explicit="false" / "0" as not explicit', () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:composer="https://composer.boidu.dev/ttml"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1"><span begin="00:01.000" end="00:01.500" composer:explicit="false">clean</span> <span begin="00:01.500" end="00:02.000" composer:explicit="0">also</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);
    const words = mainWords(result.lines[0])!;
    expect(words[0].explicit).toBeUndefined();
    expect(words[1].explicit).toBeUndefined();
  });

  it("recognizes explicit on a word inside x-bg, landing on backgroundWords", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:composer="https://composer.boidu.dev/ttml"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.500" ttm:agent="v1"><span begin="00:01.000" end="00:02.000">main</span><span ttm:role="x-bg"><span begin="00:02.000" end="00:02.250">oh</span> <span begin="00:02.250" end="00:02.500" composer:explicit="true">shit</span></span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);
    const line = result.lines[0];
    expect(mainWords(line)![0].explicit).toBeUndefined();
    expect(bgWords(line)).toBeDefined();
    expect(bgWords(line)![0].explicit).toBeUndefined();
    expect(bgWords(line)![1].text).toContain("shit");
    expect(bgWords(line)![1].explicit).toBe(true);
  });
});

describe("parseLyricsFile - TTML background provenance", () => {
  it("stamps backgroundTextSource as manual on a word-synced line with x-bg words", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.500" ttm:agent="v1"><span begin="00:01.000" end="00:02.000">main</span><span ttm:role="x-bg"><span begin="00:02.000" end="00:02.250">oh</span> <span begin="00:02.250" end="00:02.500">yeah</span></span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);
    const line = result.lines[0];
    expect(bgWords(line)).toBeDefined();
    expect(bgSource(line)).toBe("manual");
  });

  it("stamps backgroundTextSource as manual on a line-synced line with x-bg text", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:03.000" ttm:agent="v1">main line<span ttm:role="x-bg">backing vocal</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);
    const line = result.lines[0];
    expect(lineText(line)).toBe("main line");
    expect(bgText(line)).toBe("backing vocal");
    expect(bgSource(line)).toBe("manual");
  });

  it("leaves backgroundTextSource undefined on a line with no x-bg content", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1"><span begin="00:01.000" end="00:01.500">Hello</span> <span begin="00:01.500" end="00:02.000">world</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);
    expect(bgText(result.lines[0])).toBeUndefined();
    expect(bgSource(result.lines[0])).toBeUndefined();
  });

  it("leaves backgroundTextSource undefined on a line-synced line with no x-bg content", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:03.000" ttm:agent="v1">just a plain line</p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);
    expect(bgText(result.lines[0])).toBeUndefined();
    expect(bgSource(result.lines[0])).toBeUndefined();
  });
});

describe("parseLyricsFile - TTML background granularity (A/B/C)", () => {
  // Case A: x-bg with 2+ timed inner spans stays WORD-SYNCED verbatim. A
  // multi-span authored background is never downgraded to line-synced.
  describe("case A: word-synced x-bg (2+ timed spans)", () => {
    it("keeps both lines' backgrounds word-synced verbatim", () => {
      const result = parseLyricsFile("bg-word-synced.ttml", ttmlFixture("bg-word-synced"));
      expect(result.lines).toHaveLength(2);

      const [l1, l2] = result.lines;

      const l1Bg = bgWords(l1)!;
      expect(l1Bg).toHaveLength(2);
      expect(l1Bg[0].begin).toBeCloseTo(33.5, 3);
      expect(l1Bg[0].end).toBeCloseTo(34.0, 3);
      expect(l1Bg[1].begin).toBeCloseTo(34.0, 3);
      expect(l1Bg[1].end).toBeCloseTo(34.5, 3);
      // bounds come from the inner words, not the x-bg container's own begin/end
      expect(bgBounds(l1)).toEqual({ begin: 33.5, end: 34.5 });
      expect(bgText(l1)).toBe(l1Bg.map((w) => w.text).join(""));
      expect(bgText(l1)).toBe("(ooh yeah) ");
      expect(bgSource(l1)).toBe("manual");

      const l2Bg = bgWords(l2)!;
      expect(l2Bg).toHaveLength(2);
      expect(l2Bg[0].begin).toBeCloseTo(38.0, 3);
      expect(l2Bg[0].end).toBeCloseTo(39.0, 3);
      expect(l2Bg[1].begin).toBeCloseTo(39.0, 3);
      expect(l2Bg[1].end).toBeCloseTo(40.0, 3);
      expect(bgBounds(l2)).toEqual({ begin: 38, end: 40 });
      expect(bgText(l2)).toBe(l2Bg.map((w) => w.text).join(""));
      expect(bgText(l2)).toBe("(burn it) ");
      expect(bgSource(l2)).toBe("manual");
    });
  });

  // Case B (GitHub #122 regression anchor): x-bg with exactly ONE timed inner
  // span is LINE-SYNCED, carrying that span's begin/end and text, NOT a
  // one-element words array.
  describe("case B: single-span x-bg is line-synced (#122 regression)", () => {
    it("L1 single-span x-bg becomes a line-synced background", () => {
      const result = parseLyricsFile("bg-line-synced.ttml", ttmlFixture("bg-line-synced"));
      const l1 = result.lines[0];

      expect(mainWords(l1)).toBeUndefined();
      expect(bgWords(l1)).toBeUndefined();
      expect(bgBounds(l1)).toEqual({ begin: 19, end: 21 });
      expect(bgText(l1)).toBe("(ooh ooh)");
      const voice = bgVoice(l1)!;
      expect(voice).not.toBeNull();
      expect(isLineSynced(voice)).toBe(true);
      expect(bgSource(l1)).toBe("manual");
    });

    it("L2 single-span x-bg becomes a line-synced background", () => {
      const result = parseLyricsFile("bg-line-synced.ttml", ttmlFixture("bg-line-synced"));
      const l2 = result.lines[1];

      expect(mainWords(l2)).toBeUndefined();
      expect(bgWords(l2)).toBeUndefined();
      expect(bgBounds(l2)).toEqual({ begin: 23, end: 24.5 });
      expect(bgText(l2)).toBe("(yeah yeah)");
      const voice = bgVoice(l2)!;
      expect(voice).not.toBeNull();
      expect(isLineSynced(voice)).toBe(true);
      expect(bgSource(l2)).toBe("manual");
    });
  });

  // Case C: x-bg with raw text and NO timed inner spans is untimed, then
  // resolved against the main voice's granularity over its second half.
  describe("case C: untimed x-bg text resolved against main", () => {
    it("L1 untimed text over a word-synced main distributes over the second half", () => {
      const result = parseLyricsFile("bg-untimed-text.ttml", ttmlFixture("bg-untimed-text"));
      const l1 = result.lines[0];

      const words = bgWords(l1)!;
      expect(words.length).toBeGreaterThan(0);
      expect(words[0].begin).toBe(3);
      expect(words[words.length - 1].end).toBe(5);
      expect(bgText(l1)).toContain("ooh");
      expect(bgText(l1)).toContain("yeah");
      expect(bgSource(l1)).toBe("manual");
    });

    it("L2 untimed text over a line-synced main becomes line-synced over the second half", () => {
      const result = parseLyricsFile("bg-untimed-text.ttml", ttmlFixture("bg-untimed-text"));
      const l2 = result.lines[1];

      expect(mainBounds(l2)).toEqual({ begin: 6, end: 10 });
      expect(bgWords(l2)).toBeUndefined();
      expect(bgBounds(l2)).toEqual({ begin: 8, end: 10 });
      expect(bgText(l2)).toBe("(backing)");
      expect(bgSource(l2)).toBe("manual");
    });
  });

  // Mixed: authored granularity round-trips with no "correction". A line-synced
  // bg over a word-synced main stays line-synced; a word-synced bg over a
  // line-synced main stays word-synced.
  describe("mixed granularity: no correction on import", () => {
    it("L1 single-span line-synced bg stays line-synced even though main is word-synced", () => {
      const result = parseLyricsFile("bg-mixed-granularity.ttml", ttmlFixture("bg-mixed-granularity"));
      const l1 = result.lines[0];

      expect(mainWords(l1)).toBeDefined();
      expect(mainWords(l1)).toHaveLength(2);
      expect(bgWords(l1)).toBeUndefined();
      expect(bgBounds(l1)).toEqual({ begin: 3.5, end: 4.5 });
      expect(bgText(l1)).toBe("(ahh)");
      expect(isLineSynced(bgVoice(l1)!)).toBe(true);
      expect(bgSource(l1)).toBe("manual");
    });

    it("L2 two-span word-synced bg stays word-synced even though main is line-synced", () => {
      const result = parseLyricsFile("bg-mixed-granularity.ttml", ttmlFixture("bg-mixed-granularity"));
      const l2 = result.lines[1];

      expect(mainWords(l2)).toBeUndefined();
      const words = bgWords(l2)!;
      expect(words).toHaveLength(2);
      expect(words[0].begin).toBeCloseTo(7, 3);
      expect(words[0].end).toBeCloseTo(8, 3);
      expect(words[1].begin).toBeCloseTo(8, 3);
      expect(words[1].end).toBeCloseTo(9, 3);
      expect(isWordSynced(bgVoice(l2)!)).toBe(true);
      expect(bgSource(l2)).toBe("manual");
    });
  });
});
