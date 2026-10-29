/**
 * @vitest-environment node
 */
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { findRepeatingStandaloneSections } from "@/views/grouping/repeating-sections";
import { describe, expect, it } from "vitest";

function line(id: string, text: string, opts: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id, text, agentId: "v1", ...opts });
}

function detect(lines: LyricLine[], splitChar = "|") {
  return findRepeatingStandaloneSections(lines, splitChar);
}

function block(prefix: string, texts: readonly string[]): LyricLine[] {
  return texts.map((text, i) => line(`${prefix}${i}`, text));
}

const CHORUS = ["chorus a", "chorus b", "chorus c"];

describe("findRepeatingStandaloneSections", () => {
  it("returns nothing when no repeats exist", () => {
    const lines = [line("1", "a"), line("2", "b"), line("3", "c")];
    expect(detect(lines)).toEqual([]);
  });

  it("detects two contiguous chorus runs", () => {
    const lines = [line("v1", "verse"), ...block("c1-", CHORUS), line("v2", "verse 2"), ...block("c2-", CHORUS)];
    const result = detect(lines);
    expect(result).toHaveLength(1);
    expect(result[0].starts).toEqual([1, 5]);
    expect(result[0].length).toBe(3);
    expect(result[0].previewLines).toEqual(CHORUS);
    expect(result[0].fingerprint).toBeTruthy();
  });

  it("ignores a section that repeats only two lines", () => {
    const lines = [line("1", "hey"), line("2", "ho"), line("3", "verse"), line("4", "hey"), line("5", "ho")];
    expect(detect(lines)).toEqual([]);
  });

  it("fingerprint is stable when surrounding lines change but block content doesn't", () => {
    const baseChorus = block("c1-", CHORUS);
    const a = [line("v1", "verse"), ...baseChorus, line("v2", "verse 2"), ...block("c2-", CHORUS)];
    const b = [
      line("intro1", "intro 1"),
      line("intro2", "intro 2"),
      line("intro3", "intro 3"),
      ...baseChorus,
      line("v1", "verse"),
      ...block("c2-", CHORUS),
    ];
    const fpA = detect(a)[0].fingerprint;
    const fpB = detect(b)[0].fingerprint;
    expect(fpA).toBe(fpB);
  });

  it("fingerprint changes when block text changes", () => {
    const changed = ["different", "chorus b", "chorus c"];
    const fpA = detect([...block("1-", CHORUS), ...block("2-", CHORUS)])[0].fingerprint;
    const fpB = detect([...block("1-", changed), ...block("2-", changed)])[0].fingerprint;
    expect(fpA).not.toBe(fpB);
  });

  describe("regressions", () => {
    const words = (text: string, begin: number) =>
      text.split(" ").map((part, index, parts) => ({
        text: index < parts.length - 1 ? `${part} ` : part,
        begin: begin + index,
        end: begin + index + 0.5,
      }));

    it("regression: suggests a word-synced run and an untimed run of the same lyrics", () => {
      const lines = [
        line("1", "go now", { words: words("go now", 10) }),
        line("2", "stay here", { words: words("stay here", 12) }),
        line("3", "come home", { words: words("come home", 14) }),
        line("4", "go now"),
        line("5", "stay here"),
        line("6", "come home"),
      ];
      expect(detect(lines).map((section) => section.starts)).toEqual([[0, 3]]);
    });

    it("regression: suggests a word-synced run and a partly word-synced run of the same lyrics", () => {
      const lines = [
        line("1", "go now", { words: words("go now", 10) }),
        line("2", "stay here", { words: words("stay here", 12) }),
        line("3", "come home", { words: words("come home", 14) }),
        line("4", "go now", { words: words("go now", 40).slice(0, 1) }),
        line("5", "stay here"),
        line("6", "come home"),
      ];
      expect(detect(lines).map((section) => section.starts)).toEqual([[0, 3]]);
    });

    it("regression: still skips a grouped copy when choosing the best repeat", () => {
      const lines = [
        ...block("1-", ["a", "b", "c"]),
        line("4", "a"),
        line("5", "b"),
        line("6", "c", { groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }),
        ...block("7-", ["a", "b", "c"]),
      ];
      const result = detect(lines);
      expect(result.map((r) => ({ starts: r.starts, length: r.length }))).toEqual([{ starts: [0, 6], length: 3 }]);
    });
  });

  it("detects 4 contiguous chorus runs of length 4", () => {
    const chorus = ["chorus a", "chorus b", "chorus c", "chorus d"];
    const lines: LyricLine[] = [];
    let id = 0;
    for (let rep = 0; rep < 4; rep++) {
      for (const t of chorus) lines.push(line(`${id++}`, t));
      lines.push(line(`${id++}`, `verse-${rep}`));
    }
    const result = detect(lines);
    expect(result).toHaveLength(1);
    expect(result[0].starts).toHaveLength(4);
    expect(result[0].length).toBe(4);
  });

  it("prefers larger blocks: detects an 8-line block over a 3-line slice of it", () => {
    const big = Array.from({ length: 8 }, (_, i) => `line ${i}`);
    const lines: LyricLine[] = [];
    let id = 0;
    for (const t of big) lines.push(line(`${id++}`, t));
    for (const t of big) lines.push(line(`${id++}`, t));
    const result = detect(lines);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(8);
    expect(result[0].starts).toEqual([0, 8]);
  });

  it("ignores lines that already belong to a group", () => {
    const lines = [0, 1].flatMap((instanceIdx) =>
      CHORUS.map((text, templateLineIdx) =>
        line(`${instanceIdx}-${templateLineIdx}`, text, { groupId: "g1", instanceIdx, templateLineIdx }),
      ),
    );
    expect(detect(lines)).toEqual([]);
  });

  it("rejects blocks that include any grouped line", () => {
    const lines = [
      line("1", "a"),
      line("2", "b", { groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }),
      line("3", "c"),
      ...block("4-", ["a", "b", "c"]),
    ];
    expect(detect(lines)).toEqual([]);
  });

  describe("syllable splits", () => {
    it("matches repeats that differ only in syllable splits", () => {
      const lines = [
        ...block("1-", ["Although my heart is fal|ling too", "I'm in love", "with your bo|dy"]),
        line("v", "verse"),
        ...block("2-", ["Although my heart is falling too", "I'm in love", "with your body"]),
      ];
      const sections = detect(lines);
      expect(sections.map((section) => section.starts)).toEqual([[0, 4]]);
      expect(sections[0].evenedSplitLines).toBe(2);
    });

    it("matches repeats whose timed words are split in different places", () => {
      const lines: LyricLine[] = [
        {
          id: "1",
          text: "I love",
          agentId: "v1",
          words: [
            { text: "I", begin: 0, end: 1 },
            { text: " love", begin: 1, end: 2 },
          ],
        },
        { id: "2", text: "you", agentId: "v1" },
        { id: "3", text: "so", agentId: "v1" },
        { id: "4", text: "I love", agentId: "v1", words: [{ text: "I love", begin: 10, end: 11 }] },
        { id: "5", text: "you", agentId: "v1" },
        { id: "6", text: "so", agentId: "v1" },
      ];
      expect(detect(lines).map((section) => section.starts)).toEqual([[0, 3]]);
    });

    it("does not match repeats that differ in punctuation, spacing or case", () => {
      for (const variant of ["Falling too", "falling too,", "falling too ", "falling  too"]) {
        const lines = [...block("1-", ["falling too", "x", "y"]), ...block("2-", [variant, "x", "y"])];
        expect(detect(lines), variant).toEqual([]);
      }
    });

    it("regression: splits on the split character it is given", () => {
      const lines = [...block("1-", ["he/llo you", "me too", "ok then"]), ...block("2-", ["hello you", "me too", "ok then"])];
      expect(detect(lines, "/").map((section) => section.starts)).toEqual([[0, 3]]);
      expect(detect(lines, "|")).toEqual([]);
    });

    it("does not suggest a section whose partly synced copy cannot take the finest split", () => {
      const partial = line("1-0", "fal|ling too", { words: [{ text: "fal", begin: 10, end: 10.3 }] });
      const lines = [partial, line("1-1", "x"), line("1-2", "y"), ...block("2-", ["fa|lli|ng too", "x", "y"])];
      expect(detect(lines)).toEqual([]);
    });

    it("does not match background vocals that differ beyond syllable splits", () => {
      const lines = [
        ...block("1-", ["a", "b", "c"]),
        line("4", "a", { backgroundText: "ooh" }),
        line("5", "b"),
        line("6", "c"),
      ];
      expect(detect(lines)).toEqual([]);
    });
  });

  it("yields multiple distinct sections when both repeat", () => {
    const verse = ["verse a", "verse b", "verse c"];
    const lines = [
      ...block("1-", CHORUS),
      ...block("2-", CHORUS),
      line("bridge", "verse-bridge"),
      ...block("3-", verse),
      ...block("4-", verse),
    ];
    const result = detect(lines);
    expect(result).toHaveLength(2);
    expect(result[0].starts).toEqual([0, 3]);
    expect(result[1].starts).toEqual([7, 10]);
  });

  it("never lets a block contain a blank line", () => {
    const texts = ["a", "", "b", "c", "a", "", "b", "c"];
    expect(detect(texts.map((t, i) => line(`${i}`, t)))).toEqual([]);
  });

  it("prefers three short repeats over two long ones that cover fewer lines", () => {
    const texts = ["a", "b", "c", "x", "a", "b", "c", "x", "a", "b", "c"];
    const result = detect(texts.map((t, i) => line(`${i}`, t)));
    expect(result.map((r) => ({ starts: r.starts, length: r.length }))).toEqual([{ starts: [0, 4, 8], length: 3 }]);
  });

  it("suggests the three choruses without the blank separators", () => {
    const texts = [
      "Verse one a",
      "Verse one b",
      "",
      "Chorus a",
      "Chorus b",
      "Chorus c",
      "",
      "Verse two a",
      "Verse two b",
      "",
      "Chorus a",
      "Chorus b",
      "Chorus c",
      "",
      "Bridge",
      "",
      "Chorus a",
      "Chorus b",
      "Chorus c",
    ];
    const lines: LyricLine[] = texts.map((text, i) => ({ id: `l${i}`, text, agentId: "v1" }));
    const sections = detect(lines);
    expect(sections.map((s) => ({ starts: s.starts, length: s.length, first: s.previewLines[0] }))).toEqual([
      { starts: [3, 10, 16], length: 3, first: "Chorus a" },
    ]);
  });
});
