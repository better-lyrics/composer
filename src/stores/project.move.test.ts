/**
 * @vitest-environment node
 */
import { type LyricLine, useProjectStore } from "@/stores/project";
import { beforeEach, describe, expect, it } from "vitest";

const DURATION = 30;

function seedLine(overrides: Partial<LyricLine> = {}): LyricLine {
  return {
    id: "line-1",
    text: "hello world goodbye",
    agentId: "v1",
    words: [
      { text: "hello ", begin: 0, end: 1 },
      { text: "world ", begin: 1, end: 2 },
      { text: "goodbye", begin: 2, end: 3 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

// -- moveWordToBg --------------------------------------------------------------

describe("moveWordToBg", () => {
  it("moves a single word and applies timeDelta", () => {
    useProjectStore.getState().setLines([seedLine()]);

    useProjectStore.getState().moveWordToBg("line-1", [2], 5, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text)).toEqual(["hello ", "world"]);
    expect(line.backgroundWords).toHaveLength(1);
    expect(line.backgroundWords?.[0]).toEqual({ text: "goodbye", begin: 7, end: 8 });
    expect(line.backgroundText).toBe("goodbye");
  });

  it("trims trailing space from the new last main word", () => {
    useProjectStore.getState().setLines([seedLine()]);

    useProjectStore.getState().moveWordToBg("line-1", [2], 5, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.[1].text).toBe("world");
  });

  it("moves multiple selected words at once", () => {
    useProjectStore.getState().setLines([seedLine()]);

    useProjectStore.getState().moveWordToBg("line-1", [0, 2], 0, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.words?.map((w) => w.text)).toEqual(["world"]);
    expect(line.backgroundWords?.map((w) => w.text)).toEqual(["hello ", "goodbye"]);
    expect(line.backgroundText).toBe("hello goodbye");
  });

  it("adds a trailing space to the previous last bg word when a new word lands at the end", () => {
    useProjectStore.getState().setLines([
      seedLine({
        backgroundWords: [
          { text: "ah", begin: 0, end: 0.5 },
          { text: "ooh", begin: 0.5, end: 1 },
        ],
        backgroundText: "ahooh",
      }),
    ]);

    useProjectStore.getState().moveWordToBg("line-1", [2], 7, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords?.map((w) => w.text)).toEqual(["ah ", "ooh ", "goodbye"]);
    expect(line.backgroundText).toBe("ah ooh goodbye");
  });

  it("resolves overlap when moved word collides with an existing bg word", () => {
    useProjectStore.getState().setLines([
      seedLine({
        backgroundWords: [{ text: "yeah", begin: 5, end: 6 }],
        backgroundText: "yeah",
      }),
    ]);

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

// -- moveWordFromBg ------------------------------------------------------------

describe("moveWordFromBg", () => {
  it("moves a single bg word back to main and applies timeDelta", () => {
    useProjectStore.getState().setLines([
      seedLine({
        backgroundWords: [{ text: "ooh", begin: 10, end: 11 }],
        backgroundText: "ooh",
      }),
    ]);

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
    useProjectStore.getState().setLines([
      seedLine({
        backgroundWords: [
          { text: "ah ", begin: 5, end: 6 },
          { text: "ooh", begin: 6, end: 7 },
        ],
        backgroundText: "ahooh",
      }),
    ]);

    useProjectStore.getState().moveWordFromBg("line-1", [1], 3, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords?.map((w) => w.text)).toEqual(["ah"]);
    expect(line.backgroundText).toBe("ah");
  });

  it("moves multiple selected bg words at once", () => {
    useProjectStore.getState().setLines([
      seedLine({
        words: [],
        backgroundWords: [
          { text: "ah ", begin: 5, end: 6 },
          { text: "ooh ", begin: 6, end: 7 },
          { text: "yeah", begin: 7, end: 8 },
        ],
        backgroundText: "ah ooh yeah",
      }),
    ]);

    useProjectStore.getState().moveWordFromBg("line-1", [0, 2], 0, DURATION);

    const line = useProjectStore.getState().lines[0];
    expect(line.backgroundWords?.map((w) => w.text)).toEqual(["ooh"]);
    expect(line.words?.map((w) => w.text)).toEqual(["ah ", "yeah"]);
  });
});

// -- history -------------------------------------------------------------------

describe("cross-track moves and history", () => {
  it("moveWordToBg is undoable", () => {
    useProjectStore.getState().setLines([seedLine()]);
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
    useProjectStore.getState().setLines([
      seedLine({
        backgroundWords: [{ text: "ooh", begin: 10, end: 11 }],
        backgroundText: "ooh",
      }),
    ]);

    useProjectStore.getState().moveWordFromBg("line-1", [0], -7, DURATION);
    const after = useProjectStore.getState().lines[0];
    expect(after.backgroundWords).toBeUndefined();

    useProjectStore.getState().undo();
    const undone = useProjectStore.getState().lines[0];
    expect(undone.backgroundWords).toEqual([{ text: "ooh", begin: 10, end: 11 }]);
    expect(useProjectStore.getState().canRedo()).toBe(true);

    useProjectStore.getState().redo();
    const redone = useProjectStore.getState().lines[0];
    expect(redone.backgroundWords).toBeUndefined();
    expect(redone.words?.find((w) => w.text.trimEnd() === "ooh")).toBeTruthy();
  });

  it("does not push history when no words match the indices", () => {
    useProjectStore.getState().setLines([seedLine()]);
    const beforeIndex = useProjectStore.getState().historyIndex;

    useProjectStore.getState().moveWordToBg("line-1", [], 0, DURATION);
    expect(useProjectStore.getState().historyIndex).toBe(beforeIndex);

    useProjectStore.getState().moveWordToBg("nonexistent", [0], 0, DURATION);
    expect(useProjectStore.getState().historyIndex).toBe(beforeIndex);
  });
});
