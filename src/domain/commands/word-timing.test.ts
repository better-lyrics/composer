/**
 * @vitest-environment node
 */
import { replaceLines } from "@/domain/commands/line-edits";
import { setWordBoundary } from "@/domain/commands/word-timing";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

const ember = createWord({ text: "Ember ", begin: 1, end: 1.6 });
const verse = (id: string) =>
  createLine({
    id,
    text: "Ember glow",
    words: [ember, createWord({ text: "glow", begin: 1.7, end: 2.4 })],
  });

const boundary = (lineId: string) =>
  setWordBoundary({
    address: addressOf({ id: lineId }, "word", ember),
    edge: "end",
    time: 1.5,
    minDuration: 0.05,
    rolling: false,
    syllablesFollowRolling: false,
    duration: 60,
  });

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().commit(replaceLines([verse("v0")]));
});

describe("word timing commands", () => {
  it("refuses a word that is gone and leaves history alone", () => {
    const before = useProjectStore.getState().history;
    const outcome = useProjectStore.getState().commit(boundary("missing"));
    const address = { lineId: "missing", type: "word", syllableId: ember.id };
    expect(outcome).toEqual({ refused: { reason: "word-gone", address } });
    expect(useProjectStore.getState().history).toBe(before);
  });
});
