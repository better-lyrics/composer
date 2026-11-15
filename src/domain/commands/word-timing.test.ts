/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { retimeWord, setWordBoundary, stretchSelection } from "@/domain/commands/word-timing";
import { commitGesture } from "@/domain/sync/commit-gesture";
import { withSeededBackground } from "@/domain/line/background";
import { drawnSyllables } from "@/domain/line/drawn-track";
import { lineText } from "insync/line-text";
import { backgroundTrack, mainTrack, timedSyllables } from "insync/line-track";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord, createWords } from "@/test/factories";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

const ember = createWord({ text: "Ember ", begin: 1, end: 1.6 });
const verse = (id: string) =>
  createLine({
    id,
    text: "Ember glow",
    words: [ember, createWord({ text: "glow", begin: 1.7, end: 2.4 })],
  });

const boundary = (lineId: string, word = ember) =>
  setWordBoundary({
    address: addressOf({ id: lineId }, "word", word),
    edge: "end",
    time: 1.5,
    minDuration: 0.05,
    rolling: false,
    syllablesFollowRolling: false,
    duration: 60,
  });

const lineById = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id);

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [verse("v0")]));
});

describe("word timing commands", () => {
  it("refuses a word that is gone and leaves history alone", () => {
    const before = useProjectStore.getState().history;
    const outcome = useProjectStore.getState().commit(boundary("missing"));
    const address = { lineId: "missing", type: "word", syllableId: ember.id };
    expect(outcome).toEqual({ refused: { reason: "word-gone", address } });
    expect(useProjectStore.getState().history).toBe(before);
  });

  it("keeps the untimed lyrics of a partly synced line", () => {
    const ash = createWord({ text: "Ash", sep: "-", begin: 3, end: 3.4 });
    const partlySynced = createLine({
      id: "p0",
      text: "Ash-fall drifting slow",
      words: [ash, createWord({ text: "fall ", begin: 3.4, end: 3.9 })],
    });
    useProjectStore.setState({ lines: [partlySynced] });

    useProjectStore.getState().commit(boundary("p0", ash));

    expect(lineText(lineById("p0")!, DEFAULT_SPLIT_CHARACTER)).toBe("Ash-fall drifting slow");
  });

  it("retimes one copy of a linked line and leaves the other copy alone", () => {
    const group = createGroup({ id: "chorus" });
    const link = { groupId: group.id, templateLineIdx: 0 };
    const first = createLine({
      ...link,
      id: "c0",
      instanceIdx: 0,
      text: "Ember glow",
      words: [ember, createWord({ text: "glow", begin: 1.7, end: 2.4 })],
    });
    const second = createLine({
      ...link,
      id: "c1",
      instanceIdx: 1,
      text: "Ember glow!",
      words: createWords([
        { text: "Ember ", begin: 9, end: 9.6 },
        { text: "glow!", begin: 9.7, end: 10.4 },
      ]),
    });
    useProjectStore.setState({ lines: [first, second], groups: [group] });
    const copyBefore = lineById("c1");

    useProjectStore.getState().commit(boundary("c0"));

    expect(timedSyllables(mainTrack(lineById("c0")!))[0].end).toBe(1.5);
    expect(lineById("c1")).toBe(copyBefore);
  });
});

describe("timing a line-synced background", () => {
  const spanLine = () =>
    withSeededBackground(
      createLine({ id: "s0", text: "Glass harbour", begin: 10, end: 14, backgroundText: "far away" }),
      DEFAULT_SPLIT_CHARACTER,
    );
  const blockAddress = () => {
    const line = lineById("s0")!;
    return addressOf(line, "bg", drawnSyllables(line, "bg", DEFAULT_SPLIT_CHARACTER)[0]);
  };

  beforeEach(() => useProjectStore.setState({ lines: [spanLine()] }));

  it("regression: dragging an edge of its block moves the span and marks it manual", () => {
    useProjectStore.getState().commit(retimeWord({ address: blockAddress(), updates: { end: 13.5 } }));
    expect(backgroundTrack(lineById("s0")!)).toMatchObject({ begin: 12, end: 13.5, source: "manual" });
  });

  it("regression: a background Sync line mode spanned resizes from both edges", () => {
    const fresh = [
      createLine({ id: "f0", text: "Glass harbour", backgroundText: "far away" }),
      createLine({ id: "f1", text: "Paper boats" }),
    ];
    const gesture = (lines: typeof fresh, lineIndex: number, time: number) => {
      const commit = commitGesture(lines, "tap-line", {
        cursor: { lineIndex, wordIndex: 0 },
        jumped: false,
        time,
        defaultWordDuration: 0.3,
        splitChar: DEFAULT_SPLIT_CHARACTER,
      });
      const updates = [...(commit?.lineUpdates ?? [])];
      return lines.map((line) => ({ ...line, ...updates.find((update) => update.id === line.id)?.updates }));
    };
    useProjectStore.setState({ lines: gesture(gesture(fresh, 0, 10), 1, 14) });
    const address = () => {
      const line = lineById("f0")!;
      return addressOf(line, "bg", drawnSyllables(line, "bg", DEFAULT_SPLIT_CHARACTER)[0]);
    };
    useProjectStore.getState().commit(retimeWord({ address: address(), updates: { begin: 10.5 } }));
    useProjectStore.getState().commit(retimeWord({ address: address(), updates: { end: 11.5 } }));
    expect(backgroundTrack(lineById("f0")!)).toMatchObject({ begin: 10.5, end: 11.5, source: "manual" });
  });

  it("regression: stretching its block scales the span", () => {
    const stretch = stretchSelection({
      addresses: [blockAddress()],
      factor: 0.5,
      anchor: "start",
      minWordDuration: 0.05,
      duration: 60,
    });
    useProjectStore.getState().commit(stretch);
    expect(backgroundTrack(lineById("s0")!)).toMatchObject({ begin: 12, end: 13, source: "manual" });
  });
});
