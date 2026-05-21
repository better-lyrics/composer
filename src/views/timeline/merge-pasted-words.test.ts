/**
 * @vitest-environment node
 */
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";
import { mergePastedWords } from "./merge-pasted-words";

describe("mergePastedWords", () => {
  it("inserts a word boundary so a word pasted after the line's last word is not grouped with it", () => {
    const existing: WordTiming[] = [
      { text: "Hello ", begin: 0, end: 0.5 },
      { text: "world", begin: 0.5, end: 1 },
    ];
    const pasted: WordTiming[] = [
      { text: "foo ", begin: 1.2, end: 1.6 },
      { text: "bar", begin: 1.6, end: 2 },
    ];

    const result = mergePastedWords(existing, pasted);

    expect(result.map((w) => w.text)).toEqual(["Hello ", "world ", "foo ", "bar"]);
    const groups = computeSyllableGroups(result);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });

  it("preserves a genuine multi-syllable existing last word while closing it off from pasted content", () => {
    const existing: WordTiming[] = [
      { text: "ti", begin: 0, end: 0.4 },
      { text: "tle", begin: 0.4, end: 0.8 },
    ];
    const pasted: WordTiming[] = [{ text: "foo", begin: 1, end: 1.4 }];

    const result = mergePastedWords(existing, pasted);

    expect(result.map((w) => w.text)).toEqual(["ti", "tle ", "foo"]);
    const groups = computeSyllableGroups(result);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ startIndex: 0, endIndex: 1, originalWord: "title" });
  });

  it("inserts a boundary when pasted words land before the existing words", () => {
    const existing: WordTiming[] = [{ text: "world", begin: 2, end: 2.5 }];
    const pasted: WordTiming[] = [
      { text: "Hello ", begin: 0, end: 0.5 },
      { text: "there", begin: 0.5, end: 1 },
    ];

    const result = mergePastedWords(existing, pasted);

    expect(result.map((w) => w.text)).toEqual(["Hello ", "there ", "world"]);
    const groups = computeSyllableGroups(result);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });

  it("does not double-add a space when the seam word already ends with one", () => {
    const existing: WordTiming[] = [
      { text: "a ", begin: 0, end: 0.3 },
      { text: "b ", begin: 0.3, end: 0.6 },
    ];
    const pasted: WordTiming[] = [{ text: "c", begin: 1, end: 1.3 }];

    const result = mergePastedWords(existing, pasted);

    expect(result.map((w) => w.text)).toEqual(["a ", "b ", "c"]);
  });

  it("regenerates pasted syllableGroupId values so they cannot merge into an existing group at the seam", () => {
    const existing: WordTiming[] = [
      { text: "ti", begin: 0, end: 0.4, syllableGroupId: "shared" },
      { text: "tle", begin: 0.4, end: 0.8, syllableGroupId: "shared" },
    ];
    const pasted: WordTiming[] = [
      { text: "po", begin: 1, end: 1.4, syllableGroupId: "shared" },
      { text: "em", begin: 1.4, end: 1.8, syllableGroupId: "shared" },
    ];

    const result = mergePastedWords(existing, pasted);

    expect(result[1].syllableGroupId).toBe("shared");
    expect(result[2].syllableGroupId).not.toBe("shared");
    expect(result[2].syllableGroupId).toBe(result[3].syllableGroupId);
    const groups = computeSyllableGroups(result);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ startIndex: 0, endIndex: 1 });
    expect(groups[1]).toMatchObject({ startIndex: 2, endIndex: 3 });
  });

  it("returns the existing array unchanged when there is nothing to paste", () => {
    const existing: WordTiming[] = [{ text: "word", begin: 0, end: 1 }];
    expect(mergePastedWords(existing, [])).toBe(existing);
  });

  it("returns pasted words with fresh group ids when the line has no existing words", () => {
    const pasted: WordTiming[] = [
      { text: "new", begin: 0, end: 0.5, syllableGroupId: "g" },
      { text: "er", begin: 0.5, end: 1, syllableGroupId: "g" },
    ];

    const result = mergePastedWords([], pasted);

    expect(result.map((w) => w.text)).toEqual(["new", "er"]);
    expect(result[0].syllableGroupId).not.toBe("g");
    expect(result[0].syllableGroupId).toBe(result[1].syllableGroupId);
  });
});
