/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { addGroup } from "@/domain/commands/group-edits";
import { mergeSyllableGroup, snapSyllablesFlush } from "@/domain/commands/word-edits";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { newWordId } from "@/domain/word/id";
import { useChoiceStore } from "@/stores/choice-store";
import { useProjectStore } from "@/stores/project";
import { createWords } from "@/test/factories";
import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";
import { mergeSelectedWords } from "@/views/timeline/merge-selected-words";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedMainLine(overrides: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({
    id: "line-1",
    text: "ev er y world",
    agentId: "v1",
    words: [
      { id: newWordId(), text: "ev", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: newWordId(), text: "er", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: newWordId(), text: "y", sep: " ", begin: 0.6, end: 0.9, joinsNext: false },
      { id: newWordId(), text: "world", sep: "", begin: 0.9, end: 1.5, joinsNext: false },
    ],
    ...overrides,
  });
}

// -- mergeSyllableGroupIntoWord ------------------------------------------------

describe("mergeSyllableGroupIntoWord", () => {
  function seedGroupedLine(): LyricLine {
    return {
      id: "line-1",
      text: "beautiful",
      agentId: "v1",
      words: [
        { id: "w1", text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
        { id: "w2", text: "ti", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
        { id: "w3", text: "ful", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
      ],
    };
  }

  it("collapses a syllable group into one word", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedGroupedLine()] });
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [0, 1, 2]));
    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words).toHaveLength(1);
    expect(words[0].text).toBe("beautiful");
    expect(words[0].begin).toBe(0);
    expect(words[0].end).toBe(0.9);
    expect(words[0].joinsNext).toBe(false);
  });

  it("rejoins every transliteration fragment when collapsing a syllable group", () => {
    const line: LyricLine = {
      id: "line-1",
      text: "일|단|은",
      agentId: "v1",
      words: [
        {
          id: "w4",
          text: "일",
          sep: "",
          transliteration: "i",
          transliterationJoinerAfter: "",
          begin: 0,
          end: 0.3,
          joinsNext: true,
        },
        {
          id: "w5",
          text: "단",
          sep: "",
          transliteration: "ldan",
          transliterationJoinerAfter: " ",
          begin: 0.3,
          end: 0.6,
          joinsNext: true,
        },
        { id: "w6", text: "은", sep: "", transliteration: "eun", begin: 0.6, end: 0.9, joinsNext: false },
      ],
      transliteration: {
        language: "ko-Latn",
        text: "ildan eun",
        segments: [{ original: "일단은", transliteration: "ildan eun" }],
        origin: "manual",
        sourceFingerprint: "test",
      },
    };
    useProjectStore.getState().restoreLyrics({ lines: [line] });

    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [1]));

    const merged = useProjectStore.getState().lines[0];
    expect(timedSyllables(mainTrack(merged))).toEqual([
      { text: "일단은", sep: "", transliteration: "ildan eun", begin: 0, end: 0.9, joinsNext: false },
    ]);
    expect(lineText(merged)).toBe("일단은");
    expect(merged.transliteration?.text).toBe("ildan eun");
  });

  it("restores an unseparated transliteration without adding a space", () => {
    const words = splitWordIntoSyllables({
      word: { id: "w7", text: "今日", sep: "", transliteration: "kyouhi", begin: 0, end: 1, joinsNext: true },
      splitPoints: [1],
      transliterationSplitPoints: [4],
    });
    useProjectStore.getState().restoreLyrics({ lines: [{ id: "line-1", text: "今|日", agentId: "v1", words }] });

    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [0]));

    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))[0].transliteration).toBe("kyouhi");
  });

  it("does not keep a partial transliteration when one fragment is missing", () => {
    const line = seedGroupedLine();
    if (!line.words) throw new Error("expected word-synced fixture");
    timedSyllables(mainTrack(line))[0].transliteration = "beau";
    timedSyllables(mainTrack(line))[2].transliteration = "ful";
    useProjectStore.getState().restoreLyrics({ lines: [line] });

    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [0]));

    expect(useProjectStore.getState().lines[0].words?.[0].transliteration).toBeUndefined();
  });

  it("collapses the whole group when only one syllable is selected", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedGroupedLine()] });
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [1]));
    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words.map((w) => w.text)).toEqual(["beautiful"]);
  });

  it("syncs line.text to the collapsed words", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedGroupedLine()] });
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [0]));
    expect(lineText(useProjectStore.getState().lines[0])).toBe("beautiful");
  });

  it("leaves non-grouped words untouched and is a no-op on a non-grouped selection", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedMainLine()] });
    const before = useProjectStore.getState().lines[0];
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [0, 1]));
    expect(useProjectStore.getState().lines[0]).toBe(before);
  });

  it("collapses two groups touched by one multi-selection", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "abcd",
          agentId: "v1",
          words: [
            { id: "w8", text: "a", sep: "", begin: 0, end: 0.1, joinsNext: true },
            { id: "w9", text: "b", sep: "", begin: 0.1, end: 0.2, joinsNext: false },
            { id: "w10", text: "c", sep: "", begin: 0.2, end: 0.3, joinsNext: true },
            { id: "w11", text: "d", sep: "", begin: 0.3, end: 0.4, joinsNext: false },
          ],
        },
      ],
    });
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [0, 3]));
    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0])).map((w) => w.text)).toEqual(["ab", "cd"]);
  });

  it("works on the background track and syncs backgroundText", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "main",
          agentId: "v1",
          words: [{ id: "w12", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
          backgroundWords: [
            { id: "w13", text: "oo", sep: "", begin: 1, end: 1.2, joinsNext: true },
            { id: "w14", text: "oh", sep: "", begin: 1.2, end: 1.5, joinsNext: false },
          ],
          backgroundText: "ooh",
        },
      ],
    });
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "backgroundWords", [0, 1]));
    const line = useProjectStore.getState().lines[0];
    expect(timedSyllables(backgroundTrack(line)).map((w) => w.text)).toEqual(["oooh"]);
    expect(backgroundText(line)).toBe("oooh");
  });

  it("is undoable", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedGroupedLine()] });
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [0, 1, 2]));
    expect(useProjectStore.getState().canUndo()).toBe(true);
    useProjectStore.getState().undo();
    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))).toHaveLength(3);
  });
});

describe("mergeSyllableGroupIntoWord · linked propagation", () => {
  function seedTwoLinkedInstances() {
    useProjectStore.getState().commit(addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }));
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "a0",
          text: "every",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w15", text: "ev", sep: "", begin: 0, end: 0.3, joinsNext: true },
            { id: "w16", text: "er", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
            { id: "w17", text: "y", sep: "", begin: 0.6, end: 1, joinsNext: false },
          ],
        },
        {
          id: "a1",
          text: "every",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w18", text: "ev", sep: "", begin: 10, end: 10.3, joinsNext: true },
            { id: "w19", text: "er", sep: "", begin: 10.3, end: 10.6, joinsNext: true },
            { id: "w20", text: "y", sep: "", begin: 10.6, end: 11, joinsNext: false },
          ],
        },
      ],
    });
  }

  it("collapses the group on every linked sibling", () => {
    seedTwoLinkedInstances();
    useProjectStore.getState().commit(mergeSyllableGroup("a0", "words", [0, 1, 2]));

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");
    expect(timedSyllables(mainTrack(a0!)).map((w) => w.text)).toEqual(["every"]);
    expect(timedSyllables(mainTrack(a1!)).map((w) => w.text)).toEqual(["every"]);
  });
});

describe("mergeSyllableGroupIntoWord · background provenance", () => {
  it("flips backgroundTextSource to manual after a background-track merge", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "main",
          agentId: "v1",
          words: [{ id: "w21", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
          backgroundWords: [
            { id: "w22", text: "oo", sep: "", begin: 1, end: 1.2, joinsNext: true },
            { id: "w23", text: "oh", sep: "", begin: 1.2, end: 1.5, joinsNext: false },
          ],
          backgroundText: "ooh",
          backgroundTextSource: "extraction",
        },
      ],
    });
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "backgroundWords", [0, 1]));
    const line = useProjectStore.getState().lines[0];
    expect(backgroundTrack(line)?.source).toBe("manual");
    expect(timedSyllables(backgroundTrack(line)).map((w) => w.text)).toEqual(["oooh"]);
  });

  it("leaves backgroundTextSource untouched when merging the main track", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "beautiful",
          agentId: "v1",
          words: [
            { id: "w24", text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
            { id: "w25", text: "ti", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
            { id: "w26", text: "ful", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
          ],
          backgroundWords: [{ id: "w27", text: "ooh", sep: "", begin: 1, end: 1.5, joinsNext: false }],
          backgroundText: "ooh",
          backgroundTextSource: "extraction",
        },
      ],
    });
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "words", [0, 1, 2]));
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("extraction");
  });

  it("flips linked siblings to manual when a background-track merge propagates", () => {
    useProjectStore.getState().commit(addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }));
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "a0",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ id: "w28", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
          backgroundWords: [
            { id: "w29", text: "oo", sep: "", begin: 1, end: 1.2, joinsNext: true },
            { id: "w30", text: "oh", sep: "", begin: 1.2, end: 1.5, joinsNext: false },
          ],
          backgroundText: "ooh",
          backgroundTextSource: "extraction",
        },
        {
          id: "a1",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [{ id: "w31", text: "main", sep: "", begin: 10, end: 11, joinsNext: false }],
          backgroundWords: [
            { id: "w32", text: "oo", sep: "", begin: 11, end: 11.2, joinsNext: true },
            { id: "w33", text: "oh", sep: "", begin: 11.2, end: 11.5, joinsNext: false },
          ],
          backgroundText: "ooh",
          backgroundTextSource: "extraction",
        },
      ],
    });
    useProjectStore.getState().commit(mergeSyllableGroup("a0", "backgroundWords", [0, 1]));
    const lines = useProjectStore.getState().lines;
    expect(backgroundTrack(lines.find((l) => l.id === "a0")!)?.source).toBe("manual");
    expect(backgroundTrack(lines.find((l) => l.id === "a1")!)?.source).toBe("manual");
    expect(timedSyllables(backgroundTrack(lines.find((l) => l.id === "a1")!)).map((w) => w.text)).toEqual(["oooh"]);
  });

  it("undo restores the prior extraction provenance", () => {
    useProjectStore.getState().commit(
      pasteLyrics(useProjectStore.getState().lines, [
        {
          id: "line-1",
          text: "main",
          agentId: "v1",
          words: [{ id: "w34", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
          backgroundWords: [
            { id: "w35", text: "oo", sep: "", begin: 1, end: 1.2, joinsNext: true },
            { id: "w36", text: "oh", sep: "", begin: 1.2, end: 1.5, joinsNext: false },
          ],
          backgroundText: "ooh",
          backgroundTextSource: "extraction",
        },
      ]),
    );
    useProjectStore.getState().commit(mergeSyllableGroup("line-1", "backgroundWords", [0, 1]));
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("manual");
    useProjectStore.getState().undo();
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("extraction");
  });
});

// -- snapSyllablesFlush -------------------------------------------------------

describe("snapSyllablesFlush", () => {
  function seedGappedGroupLine(): LyricLine {
    return {
      id: "line-1",
      text: "beautiful",
      agentId: "v1",
      words: [
        { id: "w37", text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
        { id: "w38", text: "ti", sep: "", begin: 0.5, end: 0.8, joinsNext: true },
        { id: "w39", text: "ful", sep: "", begin: 1.0, end: 1.3, joinsNext: false },
      ],
    };
  }

  it("closes internal gaps by extending each earlier syllable's end to the next begin", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedGappedGroupLine()] });

    useProjectStore.getState().commit(snapSyllablesFlush("line-1", "words"));

    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[0].end).toBe(words[1].begin);
    expect(words[1].end).toBe(words[2].begin);
    expect(words[0].begin).toBe(0);
    expect(words[1].begin).toBe(0.5);
    expect(words[2].begin).toBe(1.0);
    expect(words[2].end).toBe(1.3);
  });

  it("is a no-op when the line has no syllable group", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedMainLine()] });
    const before = useProjectStore.getState().lines[0];

    useProjectStore.getState().commit(snapSyllablesFlush("line-1", "words"));

    expect(useProjectStore.getState().lines[0]).toBe(before);
  });

  it("is a no-op when the syllable group is already flush", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "beautiful",
          agentId: "v1",
          words: [
            { id: "w40", text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
            { id: "w41", text: "ti", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
            { id: "w42", text: "ful", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
          ],
        },
      ],
    });
    const before = useProjectStore.getState().lines[0];

    useProjectStore.getState().commit(snapSyllablesFlush("line-1", "words"));

    expect(useProjectStore.getState().lines[0]).toBe(before);
  });

  it("works on the background track", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "main",
          agentId: "v1",
          words: [{ id: "w43", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
          backgroundWords: [
            { id: "w44", text: "oo", sep: "", begin: 1, end: 1.2, joinsNext: true },
            { id: "w45", text: "oh", sep: "", begin: 1.5, end: 1.7, joinsNext: false },
          ],
          backgroundText: "oooh",
        },
      ],
    });

    useProjectStore.getState().commit(snapSyllablesFlush("line-1", "backgroundWords"));

    const bg = timedSyllables(backgroundTrack(useProjectStore.getState().lines[0]));
    expect(bg[0].end).toBe(bg[1].begin);
    expect(bg[0].begin).toBe(1);
    expect(bg[1].begin).toBe(1.5);
  });

  it("does not touch a linked sibling", () => {
    useProjectStore.getState().commit(addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }));
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "a0",
          text: "beau|ti|ful",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w46", text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
            { id: "w47", text: "ti", sep: "", begin: 0.5, end: 0.8, joinsNext: true },
            { id: "w48", text: "ful", sep: "", begin: 1.0, end: 1.3, joinsNext: false },
          ],
        },
        {
          id: "a1",
          text: "beau|ti|ful",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w49", text: "beau", sep: "", begin: 10, end: 10.3, joinsNext: true },
            { id: "w50", text: "ti", sep: "", begin: 10.5, end: 10.8, joinsNext: true },
            { id: "w51", text: "ful", sep: "", begin: 11.0, end: 11.3, joinsNext: false },
          ],
        },
      ],
    });
    const a1Before = useProjectStore.getState().lines.find((l) => l.id === "a1");

    useProjectStore.getState().commit(snapSyllablesFlush("a0", "words"));

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");
    const a0Words = a0?.words ?? [];
    expect(a0Words[0].end).toBe(a0Words[1].begin);
    expect(a0Words[1].end).toBe(a0Words[2].begin);
    expect(a1).toBe(a1Before);
  });

  it("is undoable", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedGappedGroupLine()] });
    const before = useProjectStore.getState().lines[0].words?.map((w) => ({ begin: w.begin, end: w.end }));

    useProjectStore.getState().commit(snapSyllablesFlush("line-1", "words"));
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();
    const restored = useProjectStore.getState().lines[0].words?.map((w) => ({ begin: w.begin, end: w.end }));
    expect(restored).toEqual(before);
  });
});

describe("snapSyllablesFlush · background provenance", () => {
  function seedGappedBgLine() {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "main",
          agentId: "v1",
          words: [{ id: "w52", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
          backgroundWords: [
            { id: "w53", text: "oo", sep: "", begin: 1, end: 1.2, joinsNext: true },
            { id: "w54", text: "oh", sep: "", begin: 1.5, end: 1.7, joinsNext: false },
          ],
          backgroundText: "oooh",
          backgroundTextSource: "extraction",
        },
      ],
    });
  }

  it("flips backgroundTextSource to manual after a background-track snap", () => {
    seedGappedBgLine();
    useProjectStore.getState().commit(snapSyllablesFlush("line-1", "backgroundWords"));
    const line = useProjectStore.getState().lines[0];
    expect(backgroundTrack(line)?.source).toBe("manual");
    expect(timedSyllables(backgroundTrack(line))[0].end).toBe(line.backgroundWords?.[1].begin);
    expect(backgroundText(line)).toBe("oo|oh");
  });

  it("leaves backgroundTextSource untouched when snapping the main track", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "beautiful",
          agentId: "v1",
          words: [
            { id: "w55", text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
            { id: "w56", text: "ti", sep: "", begin: 0.5, end: 0.8, joinsNext: true },
            { id: "w57", text: "ful", sep: "", begin: 1.0, end: 1.3, joinsNext: false },
          ],
          backgroundWords: [{ id: "w58", text: "ooh", sep: "", begin: 2, end: 2.5, joinsNext: false }],
          backgroundText: "ooh",
          backgroundTextSource: "extraction",
        },
      ],
    });
    useProjectStore.getState().commit(snapSyllablesFlush("line-1", "words"));
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("extraction");
  });

  it("undo restores the prior extraction provenance", () => {
    seedGappedBgLine();
    useProjectStore.getState().clearHistory();
    useProjectStore.getState().commit(snapSyllablesFlush("line-1", "backgroundWords"));
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("manual");
    useProjectStore.getState().undo();
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("extraction");
  });
});

describe("mergeSelectedWords", () => {
  it("merges part of a split word into one syllable, undone in one step", async () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "beautiful",
          agentId: "v1",
          words: [
            { id: "w59", text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
            { id: "w60", text: "ti", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
            { id: "w61", text: "ful", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
          ],
        },
      ],
    });

    await mergeSelectedWords("line-1", "word", [1, 2]);

    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))).toEqual([
      { text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
      { text: "tiful", sep: "", begin: 0.3, end: 0.9, joinsNext: false },
    ]);
    useProjectStore.getState().undo();
    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0])).map((w) => w.text)).toEqual([
      "beau",
      "ti",
      "ful",
    ]);
  });

  it("carries the merge to linked siblings with the same rhythm without asking", async () => {
    useProjectStore.getState().commit(addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }));
    const linked = (id: string, instanceIdx: number, offset: number): LyricLine => ({
      id,
      text: "every",
      agentId: "v1",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      words: createWords([
        { id: newWordId(), text: "ev", sep: "", begin: offset, end: offset + 0.3, syllableGroupId: `g_${id}` },
        { id: newWordId(), text: "er", sep: "", begin: offset + 0.3, end: offset + 0.6, syllableGroupId: `g_${id}` },
        { id: newWordId(), text: "y", sep: "", begin: offset + 0.6, end: offset + 1, syllableGroupId: `g_${id}` },
      ]),
    });
    useProjectStore.getState().restoreLyrics({ lines: [linked("a0", 0, 0), linked("a1", 1, 10)] });

    await mergeSelectedWords("a0", "word", [1, 2]);

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(timedSyllables(mainTrack(a1!)).map((w) => [w.text, w.begin, w.end])).toEqual([
      ["ev", 10, 10.3],
      ["ery", 10.3, 11],
    ]);
  });

  it("regression: a linked sibling keeps its syllable group after a partial merge", async () => {
    useProjectStore.getState().commit(addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }));
    const linked = (id: string, instanceIdx: number, offset: number): LyricLine => ({
      id,
      text: "so beautiful",
      agentId: "v1",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      words: createWords([
        { id: newWordId(), text: "so", sep: " ", begin: offset, end: offset + 0.5 },
        { id: newWordId(), text: "beau", sep: "", begin: offset + 0.5, end: offset + 0.8, syllableGroupId: `g_${id}` },
        { id: newWordId(), text: "ti", sep: "", begin: offset + 0.8, end: offset + 1.1, syllableGroupId: `g_${id}` },
        { id: newWordId(), text: "ful", sep: "", begin: offset + 1.1, end: offset + 1.6, syllableGroupId: `g_${id}` },
      ]),
    });
    useProjectStore.getState().restoreLyrics({ lines: [linked("a0", 0, 0), linked("a1", 1, 10)] });

    await mergeSelectedWords("a0", "word", [1, 2]);

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(timedSyllables(mainTrack(a1!))).toEqual([
      { text: "so", sep: " ", begin: 10, end: 10.5, joinsNext: false },
      { text: "beauti", sep: "", begin: 10.5, end: 11.1, joinsNext: true },
      { text: "ful", sep: "", begin: 11.1, end: 11.6, joinsNext: false },
    ]);
    useProjectStore.getState().undo();
    const restored = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(timedSyllables(mainTrack(restored!)).map((w) => w.text + w.sep)).toEqual(["so ", "beau", "ti", "ful"]);
  });

  it("regression: a linked copy split differently follows the merge", async () => {
    useProjectStore.getState().commit(addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }));
    const linked = (id: string, instanceIdx: number, words: NonNullable<LyricLine["words"]>): LyricLine => ({
      id,
      text: "every day",
      agentId: "v1",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      words,
    });
    useProjectStore.getState().restoreLyrics({
      lines: [
        linked("a0", 0, [
          { id: "w62", text: "every", sep: " ", begin: 0, end: 0.6, joinsNext: false },
          { id: "w63", text: "day", sep: "", begin: 0.6, end: 1, joinsNext: false },
        ]),
        linked("a1", 1, [
          { id: "w64", text: "ev", sep: "", begin: 10, end: 10.2, joinsNext: true },
          { id: "w65", text: "er", sep: "", begin: 10.2, end: 10.4, joinsNext: true },
          { id: "w66", text: "y", sep: " ", begin: 10.4, end: 10.6, joinsNext: false },
          { id: "w67", text: "day", sep: "", begin: 10.6, end: 11, joinsNext: false },
        ]),
      ],
    });

    await mergeSelectedWords("a0", "word", [0, 1]);

    const texts = (id: string) =>
      useProjectStore
        .getState()
        .lines.find((l) => l.id === id)
        ?.words?.map((w) => w.text);
    expect(texts("a0")).toEqual(["everyday"]);
    expect(texts("a1")).toEqual(["everyday"]);
  });

  it("regression: a merge leaves the other words of a differently split copy untouched", async () => {
    useProjectStore.getState().commit(addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }));
    const linked = (id: string, instanceIdx: number, words: NonNullable<LyricLine["words"]>): LyricLine => ({
      id,
      text: "one two three",
      agentId: "v1",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      words,
    });
    useProjectStore.getState().restoreLyrics({
      lines: [
        linked("a0", 0, [
          { id: "w68", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
          { id: "w69", text: "two", sep: " ", begin: 1, end: 2, joinsNext: false },
          { id: "w70", text: "three", sep: "", begin: 2, end: 3, joinsNext: false },
        ]),
        linked("a1", 1, [
          { id: "w71", text: "o", sep: "", begin: 10, end: 10.4, joinsNext: true },
          { id: "w72", text: "ne", sep: " ", begin: 10.4, end: 11, joinsNext: false },
          { id: "w73", text: "two", sep: " ", begin: 11, end: 12.5, joinsNext: false },
          { id: "w74", text: "three", sep: "", begin: 12.5, end: 13, joinsNext: false },
        ]),
      ],
    });

    await mergeSelectedWords("a0", "word", [0, 1]);

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(timedSyllables(mainTrack(a1!))).toEqual([
      { text: "onetwo", sep: " ", begin: 10, end: 12.5, joinsNext: false },
      { text: "three", sep: "", begin: 12.5, end: 13, joinsNext: false },
    ]);
  });
  describe("a linked copy whose blocks cross the merged text", () => {
    function seedCrossingCopies(): void {
      useProjectStore.getState().commit(addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }));
      const linked = (id: string, instanceIdx: number, words: NonNullable<LyricLine["words"]>): LyricLine => ({
        id,
        text: "beautiful",
        agentId: "v1",
        groupId: "g1",
        instanceIdx,
        templateLineIdx: 0,
        words,
      });
      useProjectStore.getState().restoreLyrics({
        lines: [
          linked("a0", 0, [
            { id: "w75", text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
            { id: "w76", text: "ti", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
            { id: "w77", text: "ful", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
          ]),
          linked("a1", 1, [
            { id: "w78", text: "be", sep: "", begin: 10, end: 10.2, joinsNext: true },
            { id: "w79", text: "aut", sep: "", begin: 10.2, end: 10.5, joinsNext: true },
            { id: "w80", text: "iful", sep: "", begin: 10.5, end: 10.9, joinsNext: false },
          ]),
        ],
      });
    }
    const line = (id: string) => useProjectStore.getState().lines.find((l) => l.id === id);

    it("asks, and Apply merges every block of the copy that touches the text", async () => {
      seedCrossingCopies();
      const merging = mergeSelectedWords("a0", "word", [0, 1]);
      await expect.poll(() => useChoiceStore.getState().request?.title).toBe("Word structure changed");
      useChoiceStore.getState().answer("apply");
      await merging;
      expect(timedSyllables(mainTrack(line("a0")!)).map((w) => w.text)).toEqual(["beauti", "ful"]);
      expect(timedSyllables(mainTrack(line("a1")!)).map((w) => w.text)).toEqual(["beautiful"]);
    });

    it("Detach merges only the selected line and unlinks it", async () => {
      seedCrossingCopies();
      const merging = mergeSelectedWords("a0", "word", [0, 1]);
      await expect.poll(() => useChoiceStore.getState().request?.title).toBe("Word structure changed");
      useChoiceStore.getState().answer("detach");
      await merging;
      expect(timedSyllables(mainTrack(line("a0")!)).map((w) => w.text)).toEqual(["beauti", "ful"]);
      expect(line("a0")?.groupId).toBeUndefined();
      expect(timedSyllables(mainTrack(line("a1")!)).map((w) => w.text)).toEqual(["be", "aut", "iful"]);
    });
  });
});
