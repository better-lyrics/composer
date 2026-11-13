/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { setWordBoundary } from "@/domain/commands/word-timing";
import { lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord, createWords } from "@/test/factories";

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
      text: "Ash-|fall drifting slow",
      words: [ash, createWord({ text: "fall ", begin: 3.4, end: 3.9 })],
    });
    useProjectStore.setState({ lines: [partlySynced] });

    useProjectStore.getState().commit(boundary("p0", ash));

    expect(lineText(lineById("p0")!)).toBe("Ash-|fall drifting slow");
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
