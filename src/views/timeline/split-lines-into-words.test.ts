/**
 * @vitest-environment node
 */
import { setBackground } from "@/domain/line/background";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { reconcileLine, type LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { bgVoice, bgWords, mainVoice, mainWords } from "@/domain/line/voices";
import type { WordSelection } from "@/domain/selection/model";
import { isLineSynced as isVoiceLineSynced, isWordSynced as isVoiceWordSynced } from "@/domain/voice/predicates";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";
import {
  computeSplitIntoWordsUpdates,
  computeSplitSelections,
  splitTargetLineIds,
  splitVoiceIntoWords,
} from "./split-lines-into-words";

const lineSynced: LyricLine = reconcileLine({ id: "L1", text: "one two three", agentId: "v1", begin: 1, end: 4 });
const wordSynced: LyricLine = reconcileLine({
  id: "L2",
  text: "already words",
  agentId: "v1",
  words: [{ text: "already words", begin: 5, end: 6 }],
});
const anotherSynced: LyricLine = reconcileLine({ id: "L3", text: "four five", agentId: "v1", begin: 7, end: 9 });

// A line whose MAIN is word-synced and whose BACKGROUND is line-synced. setBackground
// writes the nested background voice directly (the flat round-trip cannot express a
// line-synced background), matching how the background lane is built in production.
const bgLineSynced: LyricLine = setBackground(
  reconcileLine({ id: "B1", text: "lead vox", agentId: "v1", words: [{ text: "lead vox", begin: 0, end: 2 }] }),
  { text: "ooh ooh ooh", begin: 3, end: 6, source: "manual" },
);

// A line whose MAIN is line-synced and that has NO background at all.
const mainLineSyncedNoBg: LyricLine = reconcileLine({ id: "M1", text: "verse here", agentId: "v1", begin: 1, end: 3 });

describe("computeSplitIntoWordsUpdates (main voice)", () => {
  it("converts a line-synced line into a word update with begin/end cleared", () => {
    const updates = computeSplitIntoWordsUpdates(["L1"], [lineSynced], "main");
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("L1");
    expect(updates[0].updates.begin).toBeUndefined();
    expect(updates[0].updates.end).toBeUndefined();
    expect(updates[0].updates.words?.length).toBeGreaterThan(0);
  });

  it("distributes the line text across the line's own bounds", () => {
    const updates = computeSplitIntoWordsUpdates(["L1"], [lineSynced], "main");
    const words = updates[0].updates.words;
    expect(words).toBeDefined();
    expect(words?.length).toBe(3);
    expect(words?.[0].begin).toBe(1);
    expect(words?.[words.length - 1].end).toBe(4);
  });

  it("skips lines that are already word-synced", () => {
    const updates = computeSplitIntoWordsUpdates(["L2"], [wordSynced], "main");
    expect(updates).toHaveLength(0);
  });

  it("skips unknown ids", () => {
    const updates = computeSplitIntoWordsUpdates(["missing"], [lineSynced], "main");
    expect(updates).toHaveLength(0);
  });

  it("handles a mix of target ids, converting only the line-synced ones", () => {
    const updates = computeSplitIntoWordsUpdates(["L1", "L2", "L3"], [lineSynced, wordSynced, anotherSynced], "main");
    expect(updates.map((u) => u.id).sort()).toEqual(["L1", "L3"]);
  });

  it("ignores the background when splitting the main voice", () => {
    const updates = computeSplitIntoWordsUpdates(["B1"], [bgLineSynced], "main");
    expect(updates).toHaveLength(0);
  });
});

describe("computeSplitIntoWordsUpdates (bg voice)", () => {
  it("distributes the bg text across the bg's OWN bounds, not the main's", () => {
    const updates = computeSplitIntoWordsUpdates(["B1"], [bgLineSynced], "bg");
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("B1");
    const words = updates[0].updates.backgroundWords;
    expect(words).toBeDefined();
    expect(words?.length).toBe(3);
    expect(words?.[0].begin).toBe(3);
    expect(words?.[words.length - 1].end).toBe(6);
    expect(updates[0].updates.words).toBeUndefined();
  });

  it("skips a line whose bg is word-synced", () => {
    const wordSyncedBg = setBackground(reconcileLine({ id: "WB", text: "main", agentId: "v1", begin: 0, end: 1 }), {
      text: "(echo)",
      words: [{ text: "(echo)", begin: 2, end: 3 }],
      source: "manual",
    });
    const updates = computeSplitIntoWordsUpdates(["WB"], [wordSyncedBg], "bg");
    expect(updates).toHaveLength(0);
  });

  it("skips a line whose bg is untimed", () => {
    const untimedBg = reconcileLine({ id: "UB", text: "main", agentId: "v1", begin: 0, end: 1, backgroundText: "ooh" });
    const updates = computeSplitIntoWordsUpdates(["UB"], [untimedBg], "bg");
    expect(updates).toHaveLength(0);
  });

  it("skips a line with no background", () => {
    const updates = computeSplitIntoWordsUpdates(["M1"], [mainLineSyncedNoBg], "bg");
    expect(updates).toHaveLength(0);
  });

  it("ignores a line-synced main when the voice is bg (only the bg matters)", () => {
    const updates = computeSplitIntoWordsUpdates(["M1"], [mainLineSyncedNoBg], "bg");
    expect(updates).toHaveLength(0);
  });
});

describe("computeSplitSelections", () => {
  it("produces a word selection per converted word for the main voice", () => {
    const updates = computeSplitIntoWordsUpdates(["L1"], [lineSynced], "main");
    const selections = computeSplitSelections(updates, [lineSynced], "main");
    expect(selections.length).toBe(updates[0].updates.words?.length);
    expect(selections.every((s) => s.lineId === "L1" && s.lineIndex === 0 && s.type === "word")).toBe(true);
  });

  it("produces a bg selection per converted word for the bg voice", () => {
    const updates = computeSplitIntoWordsUpdates(["B1"], [bgLineSynced], "bg");
    const selections = computeSplitSelections(updates, [bgLineSynced], "bg");
    expect(selections.length).toBe(updates[0].updates.backgroundWords?.length);
    expect(selections.every((s) => s.lineId === "B1" && s.lineIndex === 0 && s.type === "bg")).toBe(true);
  });

  it("returns no selections when an update id is absent from the effective lines", () => {
    const updates = computeSplitIntoWordsUpdates(["L1"], [lineSynced], "main");
    const selections = computeSplitSelections(updates, [anotherSynced], "main");
    expect(selections).toHaveLength(0);
  });
});

describe("splitTargetLineIds", () => {
  const sel = (lineId: string, type: WordSelection["type"], wordIndex = 0): WordSelection => ({
    lineId,
    lineIndex: 0,
    wordIndex,
    type,
  });

  it("falls back to just the target when it is absent from the selection", () => {
    const selection = [sel("L1", "word"), sel("L2", "word")];
    expect(splitTargetLineIds(selection, "word", "L9")).toEqual(["L9"]);
  });

  it("returns every same-type selected line id when the target is among them", () => {
    const selection = [sel("L1", "word"), sel("L2", "word", 1), sel("L3", "word")];
    expect(splitTargetLineIds(selection, "word", "L2")).toEqual(["L1", "L2", "L3"]);
  });

  it("excludes selections of the other voice type", () => {
    const selection = [sel("B1", "bg"), sel("B2", "bg")];
    expect(splitTargetLineIds(selection, "word", "L1")).toEqual(["L1"]);
  });

  it("dedupes repeated line ids from multi-word selections", () => {
    const selection = [sel("L1", "word", 0), sel("L1", "word", 1), sel("L2", "word", 0)];
    expect(splitTargetLineIds(selection, "word", "L1")).toEqual(["L1", "L2"]);
  });

  it("returns just the target for an empty selection", () => {
    expect(splitTargetLineIds([], "word", "L1")).toEqual(["L1"]);
  });
});

describe("splitVoiceIntoWords · main (store-mutating)", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
    useTimelineStore.getState().clearSelection();
  });

  it("converts a single line-synced row to word-synced and selects its words", () => {
    useProjectStore.setState({ lines: [{ ...lineSynced }] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitVoiceIntoWords(["L1"], effective, "main");

    const after = useProjectStore.getState().lines[0];
    expect(mainWords(after)?.length).toBeGreaterThan(0);
    expect(isLineSynced(after)).toBe(false);
    expect(useTimelineStore.getState().selectedWords.length).toBe(mainWords(after)?.length);
    expect(useTimelineStore.getState().selectedWords.every((s) => s.type === "word")).toBe(true);
  });

  it("converts multiple line-synced rows in one history step", () => {
    useProjectStore.setState({ lines: [{ ...lineSynced }, { ...anotherSynced }] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitVoiceIntoWords(["L1", "L3"], effective, "main");

    const after = useProjectStore.getState().lines;
    const l1 = after.find((l) => l.id === "L1");
    const l3 = after.find((l) => l.id === "L3");
    expect(l1 && mainWords(l1)?.length).toBeGreaterThan(0);
    expect(l3 && mainWords(l3)?.length).toBeGreaterThan(0);
    const before = useProjectStore.getState().history.length;
    useProjectStore.getState().undo();
    const restored = useProjectStore.getState().lines;
    expect(isLineSynced(restored.find((l) => l.id === "L1")!)).toBe(true);
    expect(isLineSynced(restored.find((l) => l.id === "L3")!)).toBe(true);
    expect(before).toBeGreaterThan(0);
  });

  it("leaves a word-synced row untouched and selects nothing", () => {
    useProjectStore.setState({ lines: [{ ...wordSynced }] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitVoiceIntoWords(["L2"], effective, "main");

    expect(mainWords(useProjectStore.getState().lines[0])).toEqual(mainWords(wordSynced));
    expect(useTimelineStore.getState().selectedWords).toHaveLength(0);
  });
});

describe("splitVoiceIntoWords · bg (store-mutating)", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
    useTimelineStore.getState().clearSelection();
  });

  it("makes a line-synced bg word-synced and leaves the main untouched", () => {
    useProjectStore.setState({ lines: [{ ...bgLineSynced }] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitVoiceIntoWords(["B1"], effective, "bg");

    const after = useProjectStore.getState().lines[0];
    const bg = bgVoice(after);
    expect(bg).not.toBeNull();
    expect(isVoiceWordSynced(bg!)).toBe(true);
    expect(bgWords(after)?.length).toBeGreaterThan(0);
    expect(bgBounds(after)).toEqual({ begin: 3, end: 6 });

    // Main voice untouched.
    expect(mainWords(after)).toEqual(mainWords(bgLineSynced));
    expect(mainBounds(after)).toEqual(mainBounds(bgLineSynced));
  });

  it("selects the new bg words with type bg", () => {
    useProjectStore.setState({ lines: [{ ...bgLineSynced }] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitVoiceIntoWords(["B1"], effective, "bg");

    const after = useProjectStore.getState().lines[0];
    const selections = useTimelineStore.getState().selectedWords;
    expect(selections.length).toBe(bgWords(after)?.length);
    expect(selections.every((s) => s.lineId === "B1" && s.type === "bg")).toBe(true);
  });

  it("leaves a line-synced main with the same line untouched when voice is bg", () => {
    useProjectStore.setState({ lines: [{ ...mainLineSyncedNoBg }] });
    const effective = getEffectiveLines(useProjectStore.getState().lines);

    splitVoiceIntoWords(["M1"], effective, "bg");

    const after = useProjectStore.getState().lines[0];
    expect(isVoiceLineSynced(mainVoice(after))).toBe(true);
    expect(useTimelineStore.getState().selectedWords).toHaveLength(0);
  });
});
