import type { LyricLine } from "@/domain/line/model";
import { syncDisplayLine } from "@/views/sync/display-text";
import { describe, expect, it } from "vitest";

const line: LyricLine = {
  id: "mixed",
  agentId: "v1",
  text: "걸음은 Like a dance",
  words: [
    { text: "걸음은 ", begin: 0, end: 1 },
    { text: "Like ", begin: 1, end: 2 },
    { text: "a ", begin: 2, end: 3 },
    { text: "dance", begin: 3, end: 4 },
  ],
  transliteration: {
    language: "ko-Latn",
    text: "geol-eum-eun Like a dance",
    segments: [{ original: "걸음은 Like a dance", transliteration: "geol-eum-eun Like a dance" }],
    origin: "google",
    sourceFingerprint: "test",
  },
};

describe("Sync transliteration display", () => {
  it("keeps romanized syllables on their canonical source-word timing slot", () => {
    const display = syncDisplayLine(line, "transliteration");
    expect(display.text).toBe("geol-eum-eun Like a dance");
    expect(display.wordTexts).toEqual(["geol-eum-eun", "Like", "a", "dance"]);
    expect(display.words?.map((word) => word.text)).toEqual(line.words.map((word) => word.text));
  });

  it("returns canonical content in original mode", () => {
    expect(syncDisplayLine(line, "original")).toMatchObject({ text: line.text, words: line.words });
  });

  it("keeps all labels visible while only the timed prefix has timing", () => {
    const partial = { ...line, words: line.words.slice(0, 1) } satisfies LyricLine;
    const display = syncDisplayLine(partial, "transliteration");
    expect(display.wordTexts).toEqual(["geol-eum-eun", "Like", "a", "dance"]);
    expect(display.words).toHaveLength(1);
    expect(display.words?.[0].transliteration).toBe("geol-eum-eun");
  });
});
