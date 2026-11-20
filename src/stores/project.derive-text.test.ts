import { beforeEach, describe, expect, it } from "vitest";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { newWordId } from "@/domain/word/id";
import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
/**
 * @vitest-environment node
 */
import { useProjectStore } from "@/stores/project";

// text/words single source of truth. Whenever a store mutation writes
// a words/backgroundWords array, the paired text/backgroundText is re-derived
// via reconstructLineText. A line with no words keeps text as its primary field.

function w(text: string, begin: number, end: number): WordTiming {
  return wordFromSpaced({ id: newWordId(), text, begin, end });
}

function wordSyncedLine(overrides: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({
    id: "l1",
    text: "hello world",
    agentId: "v1",
    words: [w("hello ", 0, 1), w("world", 1, 2)],
    ...overrides,
  });
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

describe("history writes derive text only for the lines they change", () => {
  it("regression: merging syllables on one line keeps the untimed words of another", () => {
    useProjectStore.getState().setLines([
      reconcileLine({
        id: "split",
        text: "beautiful",
        agentId: "v1",
        words: [
          { id: "w1", text: "beau", sep: "", begin: 0, end: 0.3, syllableGroupId: "g1" },
          { id: "w2", text: "ti", sep: "", begin: 0.3, end: 0.6, syllableGroupId: "g1" },
          { id: "w3", text: "ful", sep: "", begin: 0.6, end: 0.9, syllableGroupId: "g1" },
        ],
      }),
      reconcileLine({ id: "partial", text: "hello world", agentId: "v1", words: [w("hello ", 1, 1.5)] }),
    ]);

    useProjectStore.getState().mergeSyllableGroupIntoWord("split", "words", [0]);

    const partial = useProjectStore.getState().lines.find((line) => line.id === "partial");
    expect(partial?.text).toBe("hello world");
  });

  it("regression: a history write after a timed word is deleted keeps the untimed words", () => {
    useProjectStore.getState().setLines([
      reconcileLine({
        id: "partial",
        text: "every night in my dreams",
        agentId: "v1",
        words: [w("every ", 0, 1), w("night ", 1, 2), w("in ", 2, 3)],
      }),
    ]);
    const afterDelete = reconcileLine({
      id: "partial",
      text: "every in my dreams",
      agentId: "v1",
      words: [w("every ", 0, 2), w("in ", 2, 3)],
    });

    useProjectStore.getState().setLinesWithHistory([afterDelete]);

    expect(useProjectStore.getState().lines[0].text).toBe("every in my dreams");
  });

  it("regression: an edit on a partly synced line keeps its untimed words", () => {
    useProjectStore.getState().setLines([
      reconcileLine({
        id: "partial",
        text: "every night in my dreams",
        agentId: "v1",
        words: [w("every ", 0, 1), w("night ", 1, 2), w("in ", 2, 3)],
      }),
    ]);

    useProjectStore.getState().toggleWordExplicit("partial", "words", [0]);
    useProjectStore.getState().snapSyllablesFlush("partial", "words");

    expect(useProjectStore.getState().lines[0].text).toBe("every night in my dreams");
  });
});

// -- updateLineWithHistory ----------------------------------------------------

describe("updateLineWithHistory derives text from words", () => {
  it("re-derives text when a word is split into two syllables", () => {
    useProjectStore.getState().setLines([wordSyncedLine()]);

    useProjectStore.getState().updateLineWithHistory("l1", {
      words: [w("hello ", 0, 1), w("wor", 1, 1.5), w("ld", 1.5, 2)],
    });

    expect(useProjectStore.getState().lines[0].text).toBe("hello wor|ld");
  });

  it("re-derives text on a plain word-text rename", () => {
    useProjectStore.getState().setLines([wordSyncedLine()]);

    useProjectStore.getState().updateLineWithHistory("l1", {
      words: [w("hi ", 0, 1), w("world", 1, 2)],
    });

    expect(useProjectStore.getState().lines[0].text).toBe("hi world");
  });

  it("re-derives backgroundText from backgroundWords", () => {
    useProjectStore.getState().setLines([
      {
        id: "l1",
        text: "main",
        agentId: "v1",
        backgroundText: "oh yeah",
        backgroundWords: [w("oh ", 0, 1), w("yeah", 1, 2)],
      },
    ]);

    useProjectStore.getState().updateLineWithHistory("l1", {
      backgroundWords: [w("oh ", 0, 1), w("ye", 1, 1.5), w("ah", 1.5, 2)],
    });

    expect(useProjectStore.getState().lines[0].backgroundText).toBe("oh ye|ah");
  });

  it("leaves text untouched for a line with no words", () => {
    useProjectStore.getState().setLines([{ id: "l1", text: "chorus line", agentId: "v1", begin: 0, end: 5 }]);

    useProjectStore.getState().updateLineWithHistory("l1", { begin: 1 });

    expect(useProjectStore.getState().lines[0].text).toBe("chorus line");
  });

  it("propagates derived text to linked siblings", () => {
    useProjectStore.getState().setLines([
      {
        id: "a",
        text: "hello world",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [w("hello ", 0, 1), w("world", 1, 2)],
      },
      {
        id: "b",
        text: "hello world",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [w("hello ", 10, 11), w("world", 11, 12)],
      },
    ]);

    useProjectStore.getState().updateLineWithHistory("a", {
      words: [w("hi ", 0, 1), w("world", 1, 2)],
    });

    const sibling = useProjectStore.getState().lines.find((l) => l.id === "b");
    expect(sibling?.text).toBe("hi world");
  });
});

// -- updateLine ---------------------------------------------------------------

describe("updateLine derives text from words", () => {
  it("re-derives text without committing history", () => {
    useProjectStore.getState().setLines([wordSyncedLine()]);

    useProjectStore.getState().updateLine("l1", {
      words: [w("hello ", 0, 1), w("wor", 1, 1.5), w("ld", 1.5, 2)],
    });

    expect(useProjectStore.getState().lines[0].text).toBe("hello wor|ld");
  });
});

// -- applyWordCountChange -----------------------------------------------------

describe("applyWordCountChange derives text from words", () => {
  it("re-derives text after an applied split", () => {
    useProjectStore.getState().setLines([wordSyncedLine()]);

    useProjectStore
      .getState()
      .applyWordCountChange("l1", [w("hello ", 0, 1), w("wor", 1, 1.5), w("ld", 1.5, 2)], "words", "apply");

    expect(useProjectStore.getState().lines[0].text).toBe("hello wor|ld");
  });
});

// -- moveWordToBg -------------------------------------------------------------

describe("moveWordToBg derives text from both tracks", () => {
  it("re-derives main text and backgroundText after a move", () => {
    useProjectStore.getState().setLines([
      {
        id: "l1",
        text: "hello world goodbye",
        agentId: "v1",
        words: [w("hello ", 0, 1), w("world ", 1, 2), w("goodbye", 2, 3)],
      },
    ]);

    useProjectStore.getState().moveWordToBg("l1", [2], 5, 30);

    const line = useProjectStore.getState().lines[0];
    expect(line.text).toBe("hello world");
    expect(line.backgroundText).toBe("goodbye");
  });
});
