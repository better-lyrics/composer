import { beforeEach, describe, expect, it } from "vitest";
import { extractBackgroundVocals } from "insync/background-vocal-extraction";
import { extractLineBackground } from "insync/commands/edit-text";
import { bgBounds } from "insync/line-bounds";
import { lineFromFields } from "insync/line-from-fields";
import type { LyricLine } from "insync/line";
import { backgroundText, lineText } from "insync/line-text";
import { roleWords } from "insync/line-track";
import { newWordId } from "insync/word-id";
import type { WordTiming } from "insync/word-timing";
import { useProjectStore } from "@/stores/project";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

function wordsAt(texts: string[], begin: number, end: number): WordTiming[] {
  const step = (end - begin) / texts.length;
  return texts.map((text, i) => ({
    id: newWordId(),
    text,
    sep: i < texts.length - 1 ? " " : "",
    joinsNext: false,
    begin: begin + i * step,
    end: begin + (i + 1) * step,
  }));
}

function linkedLine(
  id: string,
  instanceIdx: number,
  timing: { words: WordTiming[] } | { begin: number; end: number; detached?: boolean },
): LyricLine {
  return lineFromFields(
    {
      id,
      text: "hold me (ooh yeah)",
      agentId: "v1",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      ...timing,
    },
    DEFAULT_SPLIT_CHARACTER,
  );
}

describe("extracting a background on one instance", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it("regression: each linked copy keeps the timing of its own bracketed words", () => {
    const lines = [
      linkedLine("a0", 0, { words: wordsAt(["hold", "me", "(ooh", "yeah)"], 10, 14) }),
      linkedLine("a1", 1, { begin: 60, end: 63 }),
      linkedLine("a2", 2, { words: wordsAt(["hold", "me", "(ooh", "yeah)"], 110, 112) }),
      linkedLine("a3", 3, { begin: 150, end: 153, detached: true }),
    ];
    useProjectStore
      .getState()
      .restoreLyrics({ lines, groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }] });

    useProjectStore.getState().commit(extractLineBackground("a0", false));

    const [a0, a1, a2, a3] = useProjectStore.getState().lines;
    for (const line of [a0, a1, a2]) {
      expect(lineText(line, DEFAULT_SPLIT_CHARACTER)).toBe("hold me");
      expect(backgroundText(line, DEFAULT_SPLIT_CHARACTER)).toBe("ooh yeah");
    }
    expect(roleWords(a2, "bg")?.map((w) => [w.begin, w.end])).toEqual([
      [111, 111.5],
      [111.5, 112],
    ]);
    expect(bgBounds(a1)?.begin).toBeGreaterThanOrEqual(60);
    expect(bgBounds(a1)?.end).toBeLessThanOrEqual(63);
    expect(a3).toBe(lines[3]);
  });
});

describe("extracting backgrounds on every line", () => {
  it("regression: linked copies extract the same bracket groups when a timed word reaches into one", () => {
    const text = "rain bloom(cinder hush) and (low tide)";
    const timed = lineFromFields(
      {
        id: "a0",
        text,
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: wordsAt(["rain", "bloom(cinder", "hush)", "and", "(low", "tide)"], 10, 13),
      },
      DEFAULT_SPLIT_CHARACTER,
    );
    const untimed = lineFromFields(
      { id: "a1", text, agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 },
      DEFAULT_SPLIT_CHARACTER,
    );

    const extracted = extractBackgroundVocals(
      [timed, untimed],
      { mergeStandaloneLines: false, preserveBrackets: false },
      DEFAULT_SPLIT_CHARACTER,
    );

    const [timedText, untimedText] = extracted.map((line) => lineText(line, DEFAULT_SPLIT_CHARACTER));
    expect(untimedText).toBe(timedText);
    expect(extracted.map((line) => backgroundText(line, DEFAULT_SPLIT_CHARACTER))).toEqual(["low tide", "low tide"]);
  });
});
