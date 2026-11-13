import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { newWordId } from "@/domain/word/id";
import { computeSyllableGroups, getSyllablePositions } from "@/domain/word/syllable-groups";
/**
 * @vitest-environment node
 */
import { useProjectStore } from "@/stores/project";
import { beforeEach, describe, expect, it } from "vitest";

const DURATION = 30;

function seedLine(overrides: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({
    id: "line-1",
    text: "hello world goodbye",
    agentId: "v1",
    words: [
      { id: newWordId(), text: "hello", sep: " ", begin: 0, end: 1 },
      { id: newWordId(), text: "world", sep: " ", begin: 1, end: 2 },
      { id: newWordId(), text: "goodbye", sep: "", begin: 2, end: 3 },
    ],
    ...overrides,
  });
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

// -- moveWordToBg --------------------------------------------------------------

describe("moveWordToBg", () => {
  it("moves a single word and applies timeDelta", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine()] });

    useProjectStore.getState().moveWordToBg("line-1", [2], 5, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text + w.sep)).toEqual(["hello ", "world"]);
    expect(line.backgroundWords).toHaveLength(1);
    expect(line.backgroundWords?.[0]).toEqual({ text: "goodbye", sep: "", begin: 7, end: 8 });
    expect(line.backgroundText).toBe("goodbye");
  });

  it("trims trailing space from the new last main word", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine()] });

    useProjectStore.getState().moveWordToBg("line-1", [2], 5, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.[1]).toMatchObject({ text: "world", sep: "" });
  });

  it("moves multiple selected words at once", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine()] });

    useProjectStore.getState().moveWordToBg("line-1", [0, 2], 0, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text)).toEqual(["world"]);
    expect(line.backgroundWords?.map((w) => w.text + w.sep)).toEqual(["hello ", "goodbye"]);
    expect(line.backgroundText).toBe("hello goodbye");
  });

  it("adds a trailing space to the previous last bg word when a new word lands at the end without breaking syllable bonds before it", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          backgroundWords: [
            { id: "w1", text: "ah", sep: "", begin: 0, end: 0.5 },
            { id: "w2", text: "ooh", sep: "", begin: 0.5, end: 1 },
          ],
          backgroundText: "ah|ooh",
        }),
      ],
    });

    useProjectStore.getState().moveWordToBg("line-1", [2], 7, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords?.map((w) => w.text + w.sep)).toEqual(["ah", "ooh ", "goodbye"]);
    expect(line.backgroundText).toBe("ah|ooh goodbye");
  });

  it("resolves overlap when moved word collides with an existing bg word", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          backgroundWords: [{ id: "w3", text: "yeah", sep: "", begin: 5, end: 6 }],
          backgroundText: "yeah",
        }),
      ],
    });

    useProjectStore.getState().moveWordToBg("line-1", [2], 3, DURATION);

    const line = useProjectStore.getState().lines[0];
    const bg = line.backgroundWords;
    if (!bg) throw new Error("backgroundWords missing");
    expect(bg).toHaveLength(2);
    for (let i = 1; i < bg.length; i++) {
      expect(bg[i].begin).toBeGreaterThanOrEqual(bg[i - 1].end);
    }
  });
});

describe("moveWordToBg · background provenance", () => {
  it("stamps backgroundTextSource manual when creating a fresh background", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine()] });

    useProjectStore.getState().moveWordToBg("line-1", [2], 5, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundTextSource).toBe("manual");
  });

  it("flips an extraction-sourced background to manual when more words are moved in", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          backgroundWords: [{ id: "w4", text: "yeah", sep: "", begin: 5, end: 6 }],
          backgroundText: "yeah",
          backgroundTextSource: "extraction",
        }),
      ],
    });

    useProjectStore.getState().moveWordToBg("line-1", [2], 0, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundTextSource).toBe("manual");
  });
});

// -- moveWordFromBg ------------------------------------------------------------

describe("moveWordFromBg", () => {
  it("moves a single bg word back to main and applies timeDelta", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          backgroundWords: [{ id: "w5", text: "ooh", sep: "", begin: 10, end: 11 }],
          backgroundText: "ooh",
        }),
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [0], -7, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords).toBeUndefined();
    expect(line.backgroundText).toBeUndefined();
    expect(line.words?.find((w) => w.text.trimEnd() === "ooh")).toBeTruthy();
    const ooh = line.words?.find((w) => w.text.trimEnd() === "ooh");
    expect(ooh?.begin).toBe(3);
    expect(ooh?.end).toBe(4);
  });

  it("clears bg fields only when no bg words remain", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          backgroundWords: [
            { id: "w6", text: "ah", sep: " ", begin: 5, end: 6 },
            { id: "w7", text: "ooh", sep: "", begin: 6, end: 7 },
          ],
          backgroundText: "ahooh",
        }),
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [1], 3, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords?.map((w) => w.text)).toEqual(["ah"]);
    expect(line.backgroundText).toBe("ah");
  });

  it("moves multiple selected bg words at once", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          words: [],
          backgroundWords: [
            { id: "w8", text: "ah", sep: " ", begin: 5, end: 6 },
            { id: "w9", text: "ooh", sep: " ", begin: 6, end: 7 },
            { id: "w10", text: "yeah", sep: "", begin: 7, end: 8 },
          ],
          backgroundText: "ah ooh yeah",
        }),
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [0, 2], 0, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords?.map((w) => w.text)).toEqual(["ooh"]);
    expect(line.words?.map((w) => w.text + w.sep)).toEqual(["ah ", "yeah"]);
  });
});

describe("moveWordFromBg · background provenance", () => {
  it("clears backgroundTextSource when no background words remain", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          backgroundWords: [{ id: "w11", text: "ooh", sep: "", begin: 10, end: 11 }],
          backgroundText: "ooh",
          backgroundTextSource: "extraction",
        }),
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [0], -7, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords).toBeUndefined();
    expect(line.backgroundText).toBeUndefined();
    expect(line.backgroundTextSource).toBeUndefined();
  });

  it("stamps backgroundTextSource manual on the remaining background", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          backgroundWords: [
            { id: "w12", text: "ah", sep: " ", begin: 5, end: 6 },
            { id: "w13", text: "ooh", sep: "", begin: 6, end: 7 },
          ],
          backgroundText: "ahooh",
          backgroundTextSource: "extraction",
        }),
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [1], 3, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords?.map((w) => w.text)).toEqual(["ah"]);
    expect(line.backgroundTextSource).toBe("manual");
  });
});

// -- history -------------------------------------------------------------------

describe("cross-track moves and history", () => {
  it("moveWordToBg is undoable", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine()] });
    const before = useProjectStore.getState().lines[0];

    useProjectStore.getState().moveWordToBg("line-1", [2], 5, DURATION);
    expect(useProjectStore.getState().lines[0].backgroundWords).toBeTruthy();
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();
    const restored = useProjectStore.getState().lines[0];
    expect(restored.words?.map((w) => w.text)).toEqual(before.words?.map((w) => w.text));
    expect(restored.backgroundWords).toBeUndefined();
  });

  it("moveWordFromBg is undoable and redoable", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          backgroundWords: [{ id: "w14", text: "ooh", sep: "", begin: 10, end: 11 }],
          backgroundText: "ooh",
        }),
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [0], -7, DURATION);
    const after = useProjectStore.getState().lines[0];
    expect(after.backgroundWords).toBeUndefined();

    useProjectStore.getState().undo();
    const undone = useProjectStore.getState().lines[0];
    expect(undone.backgroundWords).toEqual([{ text: "ooh", sep: "", begin: 10, end: 11 }]);
    expect(useProjectStore.getState().canRedo()).toBe(true);

    useProjectStore.getState().redo();
    const redone = useProjectStore.getState().lines[0];
    expect(redone.backgroundWords).toBeUndefined();
    expect(redone.words?.find((w) => w.text.trimEnd() === "ooh")).toBeTruthy();
  });

  it("does not push history when no words match the indices", () => {
    useProjectStore.getState().restoreLyrics({ lines: [seedLine()] });
    const beforeIndex = useProjectStore.getState().historyIndex;

    useProjectStore.getState().moveWordToBg("line-1", [], 0, DURATION);
    expect(useProjectStore.getState().historyIndex).toBe(beforeIndex);

    useProjectStore.getState().moveWordToBg("nonexistent", [0], 0, DURATION);
    expect(useProjectStore.getState().historyIndex).toBe(beforeIndex);
  });

  it("preserves pre-existing intra-group gaps when applyMoveToBg leaves group syllables behind", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "every world",
          agentId: "v1",
          words: [
            { id: "w15", text: "ev", sep: "", begin: 0, end: 0.2, syllableGroupId: "g1" },
            { id: "w16", text: "er", sep: "", begin: 0.3, end: 0.5, syllableGroupId: "g1" },
            { id: "w17", text: "y", sep: "", begin: 0.5, end: 0.7, syllableGroupId: "g1" },
            { id: "w18", text: "world", sep: "", begin: 0.7, end: 1 },
          ],
        },
      ],
    });

    useProjectStore.getState().moveWordToBg("line-1", [3], 10, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.[0].end).toBe(0.2);
    expect(line.words?.[1].begin).toBe(0.3);
  });

  it("preserves pre-existing intra-group gaps when a move passes through applyMoveFromBg", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "every world",
          agentId: "v1",
          words: [
            { id: "w19", text: "ev", sep: "", begin: 0, end: 0.2, syllableGroupId: "g1" },
            { id: "w20", text: "er", sep: "", begin: 0.3, end: 0.5, syllableGroupId: "g1" },
            { id: "w21", text: "y", sep: "", begin: 0.5, end: 0.7, syllableGroupId: "g1" },
          ],
          backgroundWords: [{ id: "w22", text: "ah", sep: "", begin: 5, end: 5.5 }],
          backgroundText: "ah",
        },
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [0], 10, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.[0].end).toBe(0.2);
    expect(line.words?.[1].begin).toBe(0.3);
  });

  it("clears line.begin/end when bg→main populates main from empty", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "ooh",
          agentId: "v1",
          begin: 5,
          end: 10,
          backgroundWords: [{ id: "w23", text: "ooh", sep: "", begin: 6, end: 7 }],
          backgroundText: "ooh",
        },
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [0], 0, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.length).toBe(1);
    expect(line.begin).toBeUndefined();
    expect(line.end).toBeUndefined();
  });
});

// -- linked-instance propagation -----------------------------------------------

describe("moveWordToBg · linked propagation", () => {
  function seedTwoLinkedInstances() {
    useProjectStore.getState().addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 });
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "a0",
          text: "hello world goodbye",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w24", text: "hello", sep: " ", begin: 0, end: 1 },
            { id: "w25", text: "world", sep: " ", begin: 1, end: 2 },
            { id: "w26", text: "goodbye", sep: "", begin: 2, end: 3 },
          ],
        },
        {
          id: "a1",
          text: "hello world goodbye",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w27", text: "hello", sep: " ", begin: 10, end: 11 },
            { id: "w28", text: "world", sep: " ", begin: 11, end: 12 },
            { id: "w29", text: "goodbye", sep: "", begin: 12, end: 13 },
          ],
        },
      ],
    });
  }

  it("moves the same word to BG in all linked siblings, using each sibling's local timing", () => {
    seedTwoLinkedInstances();

    useProjectStore.getState().moveWordToBg("a0", [2], 0, DURATION);

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");

    expect(a0?.words?.map((w) => w.text + w.sep)).toEqual(["hello ", "world"]);
    expect(a0?.backgroundWords).toEqual([{ text: "goodbye", sep: "", begin: 2, end: 3 }]);

    expect(a1?.words?.map((w) => w.text + w.sep)).toEqual(["hello ", "world"]);
    expect(a1?.backgroundWords).toEqual([{ text: "goodbye", sep: "", begin: 12, end: 13 }]);
  });

  it("does not propagate to detached siblings", () => {
    seedTwoLinkedInstances();
    useProjectStore.setState((state) => ({
      lines: state.lines.map((l) => (l.id === "a1" ? { ...l, detached: true } : l)),
    }));

    useProjectStore.getState().moveWordToBg("a0", [2], 0, DURATION);

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.backgroundWords).toBeUndefined();
    expect(a1?.words?.length).toBe(3);
  });

  it("skips siblings whose word count differs (already out of sync)", () => {
    seedTwoLinkedInstances();
    useProjectStore.setState((state) => ({
      lines: state.lines.map((l) =>
        l.id === "a1"
          ? reconcileLine({
              ...l,
              words: [
                { id: newWordId(), text: "hello", sep: " ", begin: 10, end: 11 },
                { id: newWordId(), text: "goodbye", sep: "", begin: 12, end: 13 },
              ],
            })
          : l,
      ),
    }));

    useProjectStore.getState().moveWordToBg("a0", [2], 0, DURATION);

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.backgroundWords).toBeUndefined();
    expect(a1?.words?.length).toBe(2);
  });

  it("does not affect lines from other groups or standalone lines", () => {
    seedTwoLinkedInstances();
    useProjectStore.setState((state) => ({
      lines: [
        ...state.lines,
        {
          id: "x",
          text: "hello world goodbye",
          agentId: "v1",
          words: [
            { id: newWordId(), text: "hello", sep: " ", begin: 20, end: 21 },
            { id: newWordId(), text: "world", sep: " ", begin: 21, end: 22 },
            { id: newWordId(), text: "goodbye", sep: "", begin: 22, end: 23 },
          ],
        },
      ],
    }));

    useProjectStore.getState().moveWordToBg("a0", [2], 0, DURATION);

    const x = useProjectStore.getState().lines.find((l) => l.id === "x");
    expect(x?.backgroundWords).toBeUndefined();
    expect(x?.words?.length).toBe(3);
  });

  it("expands the syllable group per-sibling, not against the source layout", () => {
    useProjectStore.getState().addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 });
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
            { id: "w30", text: "ev", sep: "", begin: 0, end: 0.3, syllableGroupId: "g_a0" },
            { id: "w31", text: "er", sep: "", begin: 0.3, end: 0.6, syllableGroupId: "g_a0" },
            { id: "w32", text: "y", sep: "", begin: 0.6, end: 1, syllableGroupId: "g_a0" },
          ],
        },
        {
          id: "a1",
          text: "ev er y",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w33", text: "ev", sep: " ", begin: 10, end: 10.3 },
            { id: "w34", text: "er", sep: " ", begin: 10.3, end: 10.6 },
            { id: "w35", text: "y", sep: "", begin: 10.6, end: 11 },
          ],
        },
      ],
    });

    useProjectStore.getState().moveWordToBg("a0", [1], 5, DURATION);

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");

    expect(a0?.words).toBeUndefined();
    expect(a0?.backgroundWords?.map((w) => w.text)).toEqual(["ev", "er", "y"]);

    expect(a1?.words?.map((w) => w.text.trimEnd())).toEqual(["ev", "y"]);
    expect(a1?.backgroundWords?.map((w) => w.text)).toEqual(["er"]);
  });
});

// -- cross-track moves preserve syllable bonds --------------------------------

describe("cross-track moves auto-expand to syllable groupmates", () => {
  it("moveWordToBg expands a single-syllable selection to the whole syllable group", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "hello every world",
          agentId: "v1",
          words: [
            { id: "w36", text: "hello", sep: " ", begin: 0, end: 1 },
            { id: "w37", text: "ev", sep: "", begin: 1, end: 1.2, syllableGroupId: "g_every" },
            { id: "w38", text: "er", sep: "", begin: 1.2, end: 1.5, syllableGroupId: "g_every" },
            { id: "w39", text: "y", sep: "", begin: 1.5, end: 1.8, syllableGroupId: "g_every" },
            { id: "w40", text: "world", sep: "", begin: 1.8, end: 2.5 },
          ],
        },
      ],
    });

    useProjectStore.getState().moveWordToBg("line-1", [2], 5, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text + w.sep)).toEqual(["hello ", "world"]);
    expect(line.backgroundWords?.map((w) => w.text)).toEqual(["ev", "er", "y"]);
    expect(getSyllablePositions(line.backgroundWords ?? [])).toEqual(["first", "middle", "last"]);
  });

  it("moveWordFromBg expands a single-syllable bg selection to the whole syllable group", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "every",
          agentId: "v1",
          words: [],
          backgroundWords: [
            { id: "w41", text: "ev", sep: "", begin: 5, end: 5.2, syllableGroupId: "g_every" },
            { id: "w42", text: "er", sep: "", begin: 5.2, end: 5.5, syllableGroupId: "g_every" },
            { id: "w43", text: "y", sep: "", begin: 5.5, end: 5.8, syllableGroupId: "g_every" },
          ],
          backgroundText: "every",
        },
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [1], -4, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text)).toEqual(["ev", "er", "y"]);
    expect(getSyllablePositions(line.words ?? [])).toEqual(["first", "middle", "last"]);
    expect(line.backgroundWords).toBeUndefined();
  });
});

describe("moveWordToBg clears line.begin/end when main empties", () => {
  it("clears begin/end on a TTML-imported line whose whole syllable-grouped word is moved to bg", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "beautiful",
          agentId: "v1",
          words: [
            { id: "w44", text: "beau", sep: "", begin: 9.51, end: 11.463, syllableGroupId: "g_beautiful" },
            { id: "w45", text: "ti", sep: "", begin: 11.463, end: 13.58, syllableGroupId: "g_beautiful" },
            { id: "w46", text: "ful", sep: "", begin: 13.58, end: 15.335, syllableGroupId: "g_beautiful" },
          ],
        },
      ],
    });

    useProjectStore.getState().moveWordToBg("line-1", [1], 5, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words).toBeUndefined();
    expect(line.begin).toBeUndefined();
    expect(line.end).toBeUndefined();
    expect(line.backgroundWords?.length).toBe(3);
  });
});

describe("cross-track moves preserve syllable bonds", () => {
  it("moveWordToBg keeps remaining split-word syllables bonded", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "hello every world",
          agentId: "v1",
          words: [
            { id: "w47", text: "hello", sep: " ", begin: 0, end: 1 },
            { id: "w48", text: "ev", sep: "", begin: 1, end: 1.2 },
            { id: "w49", text: "er", sep: "", begin: 1.2, end: 1.5 },
            { id: "w50", text: "y", sep: " ", begin: 1.5, end: 1.8 },
            { id: "w51", text: "world", sep: "", begin: 1.8, end: 2.5 },
          ],
        },
      ],
    });

    useProjectStore.getState().moveWordToBg("line-1", [4], 5, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text + w.sep)).toEqual(["hello ", "ev", "er", "y"]);
    expect(getSyllablePositions(line.words ?? [])).toEqual(["none", "first", "middle", "last"]);
  });

  it("moveWordToBg keeps a whole syllable group bonded when all its indices move together", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "hello every world",
          agentId: "v1",
          words: [
            { id: "w52", text: "hello", sep: " ", begin: 0, end: 1 },
            { id: "w53", text: "ev", sep: "", begin: 1, end: 1.2 },
            { id: "w54", text: "er", sep: "", begin: 1.2, end: 1.5 },
            { id: "w55", text: "y", sep: " ", begin: 1.5, end: 1.8 },
            { id: "w56", text: "world", sep: "", begin: 1.8, end: 2.5 },
          ],
        },
      ],
    });

    useProjectStore.getState().moveWordToBg("line-1", [1, 2, 3], 5, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text + w.sep)).toEqual(["hello ", "world"]);
    expect(line.backgroundWords?.map((w) => w.text)).toEqual(["ev", "er", "y"]);
    expect(getSyllablePositions(line.backgroundWords ?? [])).toEqual(["first", "middle", "last"]);
  });

  it("moveWordFromBg adds trailing space to previously-last main word when receiving a new tail", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "hello",
          agentId: "v1",
          words: [{ id: "w57", text: "hello", sep: "", begin: 0, end: 1 }],
          backgroundWords: [{ id: "w58", text: "world", sep: "", begin: 2, end: 3 }],
          backgroundText: "world",
        },
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [0], 0, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text + w.sep)).toEqual(["hello ", "world"]);
    expect(line.backgroundWords).toBeUndefined();
  });

  it("moveWordFromBg returns a syllable group from bg intact when the whole group flips", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "line-1",
          text: "every",
          agentId: "v1",
          words: [],
          backgroundWords: [
            { id: "w59", text: "ev", sep: "", begin: 5, end: 5.2 },
            { id: "w60", text: "er", sep: "", begin: 5.2, end: 5.5 },
            { id: "w61", text: "y", sep: "", begin: 5.5, end: 5.8 },
          ],
          backgroundText: "every",
        },
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [0, 1, 2], -4, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text)).toEqual(["ev", "er", "y"]);
    expect(getSyllablePositions(line.words ?? [])).toEqual(["first", "middle", "last"]);
    expect(line.backgroundWords).toBeUndefined();
  });
});

describe("moveWordFromBg · linked propagation", () => {
  function seedTwoLinkedInstancesWithBg() {
    useProjectStore.getState().addGroup({ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 });
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "a0",
          text: "hello world",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w62", text: "hello", sep: " ", begin: 0, end: 1 },
            { id: "w63", text: "world", sep: "", begin: 1, end: 2 },
          ],
          backgroundWords: [{ id: "w64", text: "ooh", sep: "", begin: 2, end: 3 }],
          backgroundText: "ooh",
        },
        {
          id: "a1",
          text: "hello world",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w65", text: "hello", sep: " ", begin: 10, end: 11 },
            { id: "w66", text: "world", sep: "", begin: 11, end: 12 },
          ],
          backgroundWords: [{ id: "w67", text: "ooh", sep: "", begin: 12, end: 13 }],
          backgroundText: "ooh",
        },
      ],
    });
  }

  it("flips a BG word back to main in all siblings", () => {
    seedTwoLinkedInstancesWithBg();

    useProjectStore.getState().moveWordFromBg("a0", [0], 0, DURATION);

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");

    expect(a0?.backgroundWords).toBeUndefined();
    expect(a0?.words?.find((w) => w.text === "ooh")?.begin).toBe(2);

    expect(a1?.backgroundWords).toBeUndefined();
    expect(a1?.words?.find((w) => w.text === "ooh")?.begin).toBe(12);
  });
});

// -- merge seam ----------------------------------------------------------------

describe("cross-track moves space the merge seam", () => {
  it("keeps a word boundary when a moved word lands before the last bg word", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          backgroundWords: [
            { id: "w68", text: "ah", sep: " ", begin: 0, end: 0.5 },
            { id: "w69", text: "ooh", sep: "", begin: 5, end: 5.5 },
          ],
          backgroundText: "ah ooh",
        }),
      ],
    });

    useProjectStore.getState().moveWordToBg("line-1", [2], 0, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords?.map((w) => w.text + w.sep)).toEqual(["ah ", "goodbye ", "ooh"]);
    const groups = computeSyllableGroups(line.backgroundWords ?? []);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });

  it("keeps a word boundary when a bg word moves into main before the last main word", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        seedLine({
          words: [
            { id: "w70", text: "hello", sep: " ", begin: 0, end: 1 },
            { id: "w71", text: "world", sep: "", begin: 2, end: 3 },
          ],
          backgroundWords: [{ id: "w72", text: "ooh", sep: "", begin: 1.2, end: 1.6 }],
          backgroundText: "ooh",
        }),
      ],
    });

    useProjectStore.getState().moveWordFromBg("line-1", [0], 0, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text + w.sep)).toEqual(["hello ", "ooh ", "world"]);
    const groups = computeSyllableGroups(line.words ?? []);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });
});
