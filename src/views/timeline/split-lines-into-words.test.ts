/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it } from "vitest";
import { fieldsOfLine, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";
import { patchOf, updatedLine } from "@/test/field-updates";
import { legacyLine, legacyWords } from "@/test/legacy-languages";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  computeSplitIntoWordsUpdates,
  computeSplitSelections,
  splitLinesIntoWords,
  splitTargetsForMenu,
} from "./split-lines-into-words";

const lineSynced: LyricLine = lineFromFields({ id: "L1", text: "one two three", agentId: "v1", begin: 1, end: 4 });
const wordSynced: LyricLine = lineFromFields({
  id: "L2",
  text: "already words",
  agentId: "v1",
  words: [{ id: "w1", text: "already words", sep: "", begin: 5, end: 6, joinsNext: false }],
});
const anotherSynced: LyricLine = lineFromFields({ id: "L3", text: "four five", agentId: "v1", begin: 7, end: 9 });
const sentenceBg: LyricLine = lineFromFields({
  id: "L4",
  text: "main line",
  agentId: "v1",
  words: [
    { id: "w2", text: "main", sep: " ", begin: 0, end: 2, joinsNext: false },
    { id: "w3", text: "line", sep: "", begin: 2, end: 4, joinsNext: false },
  ],
  backgroundText: "ooh yeah baby",
  backgroundWords: [{ id: "w4", text: "ooh yeah baby", sep: "", begin: 1, end: 4, joinsNext: false }],
  backgroundTextSource: "manual",
});

function main(...ids: string[]) {
  return ids.map((lineId) => ({ lineId, type: "word" as const }));
}

function bg(...ids: string[]) {
  return ids.map((lineId) => ({ lineId, type: "bg" as const }));
}

describe("computeSplitIntoWordsUpdates", () => {
  it("converts a line-synced line into a word update with begin/end cleared", () => {
    const updates = computeSplitIntoWordsUpdates(main("L1"), [lineSynced]);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("L1");
    expect(updatedLine(updates[0].updates) && mainTrack(updatedLine(updates[0].updates)!).begin).toBeUndefined();
    expect(updatedLine(updates[0].updates) && mainTrack(updatedLine(updates[0].updates)!).end).toBeUndefined();
    expect(roleWords(updatedLine(updates[0].updates), "main")?.length).toBeGreaterThan(0);
  });

  it("skips lines that are already word-synced", () => {
    const updates = computeSplitIntoWordsUpdates(main("L2"), [wordSynced]);
    expect(updates).toHaveLength(0);
  });

  it("skips unknown ids", () => {
    const updates = computeSplitIntoWordsUpdates(main("missing"), [lineSynced]);
    expect(updates).toHaveLength(0);
  });

  it("handles a mix of target ids, converting only the line-synced ones", () => {
    const updates = computeSplitIntoWordsUpdates(main("L1", "L2", "L3"), [lineSynced, wordSynced, anotherSynced]);
    expect(updates.map((u) => u.id).sort()).toEqual(["L1", "L3"]);
  });
});

describe("computeSplitSelections", () => {
  it("produces a word selection per converted word, addressed by the new word ids", () => {
    const updates = computeSplitIntoWordsUpdates(main("L1"), [lineSynced]);
    const selections = computeSplitSelections(updates, [lineSynced]);
    expect(selections.map((s) => s.syllableId)).toEqual(
      roleWords(updatedLine(updates[0].updates), "main")?.map((word) => word.id),
    );
    expect(selections.every((s) => s.lineId === "L1" && s.type === "word")).toBe(true);
  });

  it("returns no selections when an update id is absent from the lines", () => {
    const updates = computeSplitIntoWordsUpdates(main("L1"), [lineSynced]);
    const selections = computeSplitSelections(updates, [anotherSynced]);
    expect(selections).toHaveLength(0);
  });
});

describe("splitLinesIntoWords (store-mutating)", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
    useTimelineStore.getState().clearSelection();
  });

  it("converts a single line-synced row to word-synced and selects its words", () => {
    useProjectStore.setState({ lines: [{ ...lineSynced }] });
    const { lines } = useProjectStore.getState();

    splitLinesIntoWords(main("L1"), lines);

    const after = useProjectStore.getState().lines[0];
    expect(roleWords(after, "main")?.length).toBeGreaterThan(0);
    expect(mainTrack(after).begin).toBeUndefined();
    expect(mainTrack(after).end).toBeUndefined();
    expect(useTimelineStore.getState().selectedWords.length).toBe(roleWords(after, "main")?.length);
  });

  it("converts multiple line-synced rows in one history step", () => {
    useProjectStore.setState({ lines: [{ ...lineSynced }, { ...anotherSynced }] });
    const { lines } = useProjectStore.getState();

    splitLinesIntoWords(main("L1", "L3"), lines);

    const after = useProjectStore.getState().lines;
    expect(
      roleWords(
        after.find((l) => l.id === "L1"),
        "main",
      )?.length,
    ).toBeGreaterThan(0);
    expect(
      roleWords(
        after.find((l) => l.id === "L3"),
        "main",
      )?.length,
    ).toBeGreaterThan(0);
  });

  it("leaves a word-synced row untouched and selects nothing", () => {
    useProjectStore.setState({ lines: [{ ...wordSynced }] });
    const { lines } = useProjectStore.getState();

    splitLinesIntoWords(main("L2"), lines);

    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))).toEqual(
      timedSyllables(mainTrack(wordSynced)),
    );
    expect(useTimelineStore.getState().selectedWords).toHaveLength(0);
  });
});

describe("computeSplitIntoWordsUpdates · background track", () => {
  it("splits a single sentence-long bg word evenly across its span", () => {
    const updates = computeSplitIntoWordsUpdates(bg("L4"), [sentenceBg]);
    expect(updates).toHaveLength(1);
    expect(roleWords(updatedLine(updates[0].updates), "bg")).toEqual([
      { text: "ooh", sep: " ", begin: 1, end: 2, joinsNext: false },
      { text: "yeah", sep: " ", begin: 2, end: 3, joinsNext: false },
      { text: "baby", sep: "", begin: 3, end: 4, joinsNext: false },
    ]);
    expect(backgroundText(updatedLine(updates[0].updates))).toBe("ooh yeah baby");
    expect(updatedLine(updates[0].updates) && backgroundTrack(updatedLine(updates[0].updates)!)?.source).toBe("manual");
    expect("words" in patchOf(updates[0].updates, sentenceBg)).toBe(false);
  });

  it("does not copy a bg word's transliteration onto every split piece", () => {
    const line = legacyLine({
      ...fieldsOfLine(sentenceBg),
      backgroundWords: [
        {
          id: "w5",
          text: "ooh yeah baby",
          sep: "",
          begin: 1,
          end: 4,
          transliteration: "u  ye  bei",
          transliterationJoinerAfter: " ",
          joinsNext: false,
        },
      ],
      transliteration: {
        language: "en-Latn",
        text: "",
        backgroundText: "u  ye  bei",
        segments: [],
        origin: "manual",
        sourceFingerprint: "test",
      },
    });
    const [update] = computeSplitIntoWordsUpdates(bg("L4"), [line]);
    const words = legacyWords(roleWords(updatedLine(update.updates), "bg"), update.updates.languages, "bg") ?? [];
    expect(words.length).toBeGreaterThan(1);
    for (const word of words) {
      expect(word).not.toHaveProperty("transliteration");
      expect(word).not.toHaveProperty("transliterationJoinerAfter");
    }
  });

  it("splits only the multi-word bg word and leaves its neighbours' timing alone", () => {
    const line: LyricLine = lineFromFields({
      ...fieldsOfLine(sentenceBg),
      backgroundText: "ah ooh yeah",
      backgroundWords: [
        { id: "w6", text: "ah", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w7", text: "ooh yeah", sep: "", begin: 1, end: 3, joinsNext: false },
      ],
    });
    const updates = computeSplitIntoWordsUpdates(bg("L4"), [line]);
    expect(roleWords(updatedLine(updates[0].updates), "bg")).toEqual([
      { text: "ah", sep: " ", begin: 0, end: 1, joinsNext: false },
      { text: "ooh", sep: " ", begin: 1, end: 2, joinsNext: false },
      { text: "yeah", sep: "", begin: 2, end: 3, joinsNext: false },
    ]);
  });

  it("does not touch the bg track when only the main track is targeted", () => {
    expect(computeSplitIntoWordsUpdates(main("L4"), [sentenceBg])).toHaveLength(0);
  });

  it("targets main and bg together when both are selected on a line-synced line", () => {
    const line: LyricLine = lineFromFields({
      id: "L5",
      text: "one two",
      agentId: "v1",
      begin: 0,
      end: 2,
      backgroundText: "ooh ah",
      backgroundWords: [{ id: "w8", text: "ooh ah", sep: "", begin: 0, end: 2, joinsNext: false }],
    });
    const updates = computeSplitIntoWordsUpdates([...main("L5"), ...bg("L5")], [line]);
    expect(updates).toHaveLength(1);
    expect(roleWords(updatedLine(updates[0].updates), "main")?.map((w) => w.text + w.sep)).toEqual(["one ", "two"]);
    expect(roleWords(updatedLine(updates[0].updates), "bg")?.map((w) => w.text + w.sep)).toEqual(["ooh ", "ah"]);
  });

  it("regression: a bg-only target leaves a line-synced main line untouched", () => {
    const line: LyricLine = lineFromFields({
      id: "L5",
      text: "one two",
      agentId: "v1",
      begin: 0,
      end: 2,
      backgroundText: "ooh ah",
      backgroundWords: [{ id: "w9", text: "ooh ah", sep: "", begin: 0, end: 2, joinsNext: false }],
    });
    const updates = computeSplitIntoWordsUpdates(bg("L5"), [line]);
    expect(updates).toHaveLength(1);
    expect("words" in patchOf(updates[0].updates, line)).toBe(false);
    expect(roleWords(updatedLine(updates[0].updates), "bg")?.map((w) => w.text + w.sep)).toEqual(["ooh ", "ah"]);
  });

  describe("edge cases", () => {
    it("skips a bg track that is already one word per word", () => {
      const line: LyricLine = lineFromFields({
        ...fieldsOfLine(sentenceBg),
        backgroundWords: [
          { id: "w10", text: "ooh", sep: " ", begin: 1, end: 2, joinsNext: false },
          { id: "w11", text: "yeah", sep: "", begin: 2, end: 3, joinsNext: false },
        ],
      });
      expect(computeSplitIntoWordsUpdates(bg("L4"), [line])).toHaveLength(0);
    });

    it("skips a single-word bg", () => {
      const line: LyricLine = lineFromFields({
        ...fieldsOfLine(sentenceBg),
        backgroundText: "ooh",
        backgroundWords: [{ id: "w12", text: "ooh", sep: "", begin: 1, end: 2, joinsNext: false }],
      });
      expect(computeSplitIntoWordsUpdates(bg("L4"), [line])).toHaveLength(0);
    });

    it("skips a line with untimed bg text only", () => {
      const line: LyricLine = lineFromFields({ id: "L6", text: "x", agentId: "v1", backgroundText: "ooh yeah" });
      expect(computeSplitIntoWordsUpdates(bg("L6"), [line])).toHaveLength(0);
    });

    it("keeps a trailing space on the last split word when the source word had one", () => {
      const line: LyricLine = lineFromFields({
        ...fieldsOfLine(sentenceBg),
        backgroundWords: [
          { id: "w13", text: "ooh yeah", sep: " ", begin: 1, end: 3, joinsNext: false },
          { id: "w14", text: "baby", sep: "", begin: 3, end: 4, joinsNext: false },
        ],
      });
      const words = roleWords(updatedLine(computeSplitIntoWordsUpdates(bg("L4"), [line])[0].updates), "bg");
      expect(words?.map((w) => w.text + w.sep)).toEqual(["ooh ", "yeah ", "baby"]);
    });

    it("emits one update per line even when several bg words on it are selected", () => {
      expect(computeSplitIntoWordsUpdates([...bg("L4"), ...bg("L4")], [sentenceBg])).toHaveLength(1);
    });
  });

  describe("regressions", () => {
    it("regression: split parts keep the source word's explicit flag", () => {
      const line: LyricLine = lineFromFields({
        ...fieldsOfLine(sentenceBg),
        backgroundWords: [{ id: "w15", text: "ooh yeah", sep: "", begin: 1, end: 3, explicit: true, joinsNext: false }],
      });
      const words = roleWords(updatedLine(computeSplitIntoWordsUpdates(bg("L4"), [line])[0].updates), "bg");
      expect(words?.map((w) => w.explicit)).toEqual([true, true]);
    });

    it("regression: split parts drop the source word's syllable group", () => {
      const line: LyricLine = lineFromFields({
        ...fieldsOfLine(sentenceBg),
        backgroundWords: [{ id: "w16", text: "ooh yeah", sep: "", begin: 1, end: 3, joinsNext: false }],
      });
      const words = roleWords(updatedLine(computeSplitIntoWordsUpdates(bg("L4"), [line])[0].updates), "bg");
      expect(words?.every((w) => !("syllableGroupId" in w))).toBe(true);
    });
  });

  describe("invariants", () => {
    it("does not mutate the input line", () => {
      const snapshot = structuredClone(sentenceBg);
      computeSplitIntoWordsUpdates(bg("L4"), [sentenceBg]);
      expect(sentenceBg).toEqual(snapshot);
    });
  });
});

describe("computeSplitSelections · background track", () => {
  it("selects the new bg words on the bg track", () => {
    const updates = computeSplitIntoWordsUpdates(bg("L4"), [sentenceBg]);
    const selections = computeSplitSelections(updates, [sentenceBg]);
    expect(selections).toEqual(
      (roleWords(updatedLine(updates[0].updates), "bg") ?? []).map((word) => ({
        lineId: "L4",
        type: "bg",
        syllableId: word.id,
      })),
    );
    expect(selections).toHaveLength(3);
  });
});

describe("splitTargetsForMenu", () => {
  const selection = (lineId: string, type: "word" | "bg", wordIndex = 0) => ({
    lineId,
    type,
    syllableId: `w${wordIndex}`,
  });

  it("uses the target alone when nothing on its line is selected", () => {
    expect(splitTargetsForMenu({ lineId: "L1", type: "word" }, [selection("L2", "word")])).toEqual([
      { lineId: "L1", type: "word" },
    ]);
  });

  it("uses the selection plus the target when the selection touches its line", () => {
    const targets = splitTargetsForMenu({ lineId: "L1", type: "word" }, [
      selection("L1", "word"),
      selection("L2", "bg"),
    ]);
    expect(targets).toEqual(expect.arrayContaining([expect.objectContaining({ lineId: "L2", type: "bg" })]));
    expect(targets).toEqual(expect.arrayContaining([expect.objectContaining({ lineId: "L1", type: "word" })]));
  });

  describe("regressions", () => {
    it("regression: right-clicking main with a bg word selected on the same line still splits main", () => {
      const line: LyricLine = lineFromFields({
        id: "L5",
        text: "one two",
        agentId: "v1",
        begin: 0,
        end: 2,
        backgroundText: "ooh",
        backgroundWords: [{ id: "w17", text: "ooh", sep: "", begin: 0, end: 2, joinsNext: false }],
      });
      const targets = splitTargetsForMenu({ lineId: "L5", type: "word" }, [selection("L5", "bg")]);
      const updates = computeSplitIntoWordsUpdates(targets, [line]);
      expect(updates).toHaveLength(1);
      expect(roleWords(updatedLine(updates[0].updates), "main")?.map((w) => w.text + w.sep)).toEqual(["one ", "two"]);
    });

    it("regression: right-clicking a multi-word bg with main selected on the same line still splits bg", () => {
      const targets = splitTargetsForMenu({ lineId: "L4", type: "bg" }, [selection("L4", "word")]);
      const updates = computeSplitIntoWordsUpdates(targets, [sentenceBg]);
      expect(roleWords(updatedLine(updates[0].updates), "bg")?.map((w) => w.text + w.sep)).toEqual([
        "ooh ",
        "yeah ",
        "baby",
      ]);
    });
  });
});

describe("splitLinesIntoWords · regressions", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
    useTimelineStore.getState().clearSelection();
  });

  it("regression: W splits a bg sentence typed into one placeholder word", () => {
    useProjectStore.setState({ lines: [structuredClone(sentenceBg)] });
    const { lines } = useProjectStore.getState();

    splitLinesIntoWords(bg("L4"), lines);

    const after = useProjectStore.getState().lines[0];
    expect(timedSyllables(backgroundTrack(after)).map((w) => w.text + w.sep)).toEqual(["ooh ", "yeah ", "baby"]);
    expect(timedSyllables(mainTrack(after))).toEqual(timedSyllables(mainTrack(sentenceBg)));
    expect(useTimelineStore.getState().selectedWords.every((s) => s.type === "bg")).toBe(true);
    expect(useTimelineStore.getState().selectedWords).toHaveLength(3);
  });
});
