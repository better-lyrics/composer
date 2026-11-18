import { type LineFields, lineFromFields } from "insync/line-from-fields";
import { beforeEach, describe, expect, it } from "vitest";
import { pasteLyrics } from "insync/commands/edit-text";
import { pasteLines } from "insync/commands/instance-rows";
import { lineEditCommand } from "insync/commands/line-edits";
import { mergeSyllableGroup, snapSyllablesFlush, toggleWordExplicit } from "insync/commands/word-edits";
import { splitWord } from "insync/commands/word-structure";
import type { LyricLine } from "insync/line";
import { backgroundText, lineText } from "insync/line-text";
import { newWordId } from "insync/word-id";
import { wordFromSpaced } from "insync/word-spaced-words";
import type { WordTiming } from "insync/word-timing";

/**
 * @vitest-environment node
 */
import { useProjectStore } from "@/stores/project";
import { fieldUpdates } from "@/test/field-updates";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// text/words single source of truth. Whenever a store mutation writes
// a words/backgroundWords array, the paired text/backgroundText is re-derived
// via reconstructLineText. A line with no words keeps text as its primary field.

function w(text: string, begin: number, end: number): WordTiming {
  return wordFromSpaced({ id: newWordId(), text, begin, end });
}

// A syllable split from its word, joined to the next.
function joined(text: string, begin: number, end: number): WordTiming {
  return wordFromSpaced({ id: newWordId(), text, begin, end, joinsNext: true });
}

function wordSyncedLine(overrides: Partial<LineFields> = {}): LyricLine {
  return lineFromFields(
    {
      id: "l1",
      text: "hello world",
      agentId: "v1",
      words: [w("hello ", 0, 1), w("world", 1, 2)],
      ...overrides,
    },
    DEFAULT_SPLIT_CHARACTER,
  );
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

describe("history writes derive text only for the lines they change", () => {
  it("regression: merging syllables on one line keeps the untimed words of another", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        lineFromFields(
          {
            id: "split",
            text: "beautiful",
            agentId: "v1",
            words: [
              { id: "w1", text: "beau", sep: "", begin: 0, end: 0.3, joinsNext: true },
              { id: "w2", text: "ti", sep: "", begin: 0.3, end: 0.6, joinsNext: true },
              { id: "w3", text: "ful", sep: "", begin: 0.6, end: 0.9, joinsNext: false },
            ],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
        lineFromFields(
          { id: "partial", text: "hello world", agentId: "v1", words: [w("hello ", 1, 1.5)] },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
    });

    useProjectStore.getState().commit(mergeSyllableGroup("split", "words", [0]));

    const partial = useProjectStore.getState().lines.find((line) => line.id === "partial");
    expect(lineText(partial!, DEFAULT_SPLIT_CHARACTER)).toBe("hello world");
  });

  it("regression: a history write after a timed word is deleted keeps the untimed words", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        lineFromFields(
          {
            id: "partial",
            text: "every night in my dreams",
            agentId: "v1",
            words: [w("every ", 0, 1), w("night ", 1, 2), w("in ", 2, 3)],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
    });
    const afterDelete = lineFromFields(
      {
        id: "partial",
        text: "every in my dreams",
        agentId: "v1",
        words: [w("every ", 0, 2), w("in ", 2, 3)],
      },
      DEFAULT_SPLIT_CHARACTER,
    );

    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [afterDelete]));

    expect(lineText(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER)).toBe("every in my dreams");
  });

  it("regression: an edit on a partly synced line keeps its untimed words", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        lineFromFields(
          {
            id: "partial",
            text: "every night in my dreams",
            agentId: "v1",
            words: [w("every ", 0, 1), w("night ", 1, 2), w("in ", 2, 3)],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
    });

    useProjectStore.getState().commit(toggleWordExplicit("partial", "words", [0]));
    useProjectStore.getState().commit(snapSyllablesFlush("partial", "words"));

    expect(lineText(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER)).toBe("every night in my dreams");
  });
});

// -- updateLineWithHistory ----------------------------------------------------

describe("updateLineWithHistory derives text from words", () => {
  it("re-derives text when a word is split into two syllables", () => {
    useProjectStore.getState().restoreLyrics({ lines: [wordSyncedLine()] });

    useProjectStore.getState().commit(
      pasteLines(
        fieldUpdates([
          {
            id: "l1",
            updates: {
              words: [w("hello ", 0, 1), joined("wor", 1, 1.5), w("ld", 1.5, 2)],
            },
          },
        ]),
      ),
    );

    expect(lineText(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER)).toBe("hello wor|ld");
  });

  it("re-derives text on a plain word-text rename", () => {
    useProjectStore.getState().restoreLyrics({ lines: [wordSyncedLine()] });

    useProjectStore.getState().commit(
      pasteLines(
        fieldUpdates([
          {
            id: "l1",
            updates: {
              words: [w("hi ", 0, 1), w("world", 1, 2)],
            },
          },
        ]),
      ),
    );

    expect(lineText(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER)).toBe("hi world");
  });

  it("re-derives backgroundText from backgroundWords", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        lineFromFields(
          {
            id: "l1",
            text: "main",
            agentId: "v1",
            backgroundText: "oh yeah",
            backgroundWords: [w("oh ", 0, 1), w("yeah", 1, 2)],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
    });

    useProjectStore.getState().commit(
      pasteLines(
        fieldUpdates([
          {
            id: "l1",
            updates: {
              backgroundWords: [w("oh ", 0, 1), joined("ye", 1, 1.5), w("ah", 1.5, 2)],
            },
          },
        ]),
      ),
    );

    expect(backgroundText(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER)).toBe("oh ye|ah");
  });

  it("leaves text untouched for a line with no words", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        lineFromFields({ id: "l1", text: "chorus line", agentId: "v1", begin: 0, end: 5 }, DEFAULT_SPLIT_CHARACTER),
      ],
    });

    useProjectStore.getState().commit(pasteLines(fieldUpdates([{ id: "l1", updates: { begin: 1 } }])));

    expect(lineText(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER)).toBe("chorus line");
  });

  it("propagates derived text to linked siblings", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        lineFromFields(
          {
            id: "a",
            text: "hello world",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 0,
            templateLineIdx: 0,
            words: [w("hello ", 0, 1), w("world", 1, 2)],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
        lineFromFields(
          {
            id: "b",
            text: "hello world",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 1,
            templateLineIdx: 0,
            words: [w("hello ", 10, 11), w("world", 11, 12)],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
    });

    useProjectStore.getState().commit(
      pasteLines(
        fieldUpdates([
          {
            id: "a",
            updates: {
              words: [w("hi ", 0, 1), w("world", 1, 2)],
            },
          },
        ]),
      ),
    );

    const sibling = useProjectStore.getState().lines.find((l) => l.id === "b");
    expect(lineText(sibling!, DEFAULT_SPLIT_CHARACTER)).toBe("hi world");
  });
});

// -- updateLine ---------------------------------------------------------------

describe("updateLine derives text from words", () => {
  it("re-derives text without committing history", () => {
    useProjectStore.getState().restoreLyrics({ lines: [wordSyncedLine()] });

    useProjectStore.getState().commit(
      lineEditCommand(
        { command: "edit lines", args: [] },
        () =>
          fieldUpdates([
            {
              id: "l1",
              updates: {
                words: [w("hello ", 0, 1), joined("wor", 1, 1.5), w("ld", 1.5, 2)],
              },
            },
          ]),
        { copiesSharedTiming: false },
      ),
      "pending",
    );

    expect(lineText(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER)).toBe("hello wor|ld");
  });
});

// -- splitWord -----------------------------------------------------------------

describe("splitWord derives text from words", () => {
  it("re-derives text after an applied split", () => {
    useProjectStore.getState().restoreLyrics({ lines: [wordSyncedLine()] });

    useProjectStore
      .getState()
      .commit(splitWord("l1", "words", [w("hello ", 0, 1), joined("wor", 1, 1.5), w("ld", 1.5, 2)], {}));

    expect(lineText(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER)).toBe("hello wor|ld");
  });
});
