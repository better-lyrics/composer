/**
 * @vitest-environment node
 */
import { replaceLines } from "@/domain/commands/line-edits";
import { mergeWords } from "@/domain/commands/word-merge";
import { deleteWords } from "@/domain/commands/word-structure";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

const still = createWord({ text: "still ", begin: 1, end: 1.4 });
const water = createWord({ text: "water", begin: 1.5, end: 2 });
const run = [addressOf({ id: "l1" }, "word", still), addressOf({ id: "l1" }, "word", water)];

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore
    .getState()
    .commit(replaceLines([createLine({ id: "l1", text: "still water", words: [still, water] })]));
});

describe("word merge command", () => {
  it("refuses a run whose words are gone and leaves history alone", () => {
    useProjectStore.getState().commit(deleteWords([run[1]]));
    const before = useProjectStore.getState().history;
    const outcome = useProjectStore.getState().commit(mergeWords(run, "apply"));
    expect(outcome).toEqual({ refused: { reason: "word-gone", address: run[0] } });
    expect(useProjectStore.getState().history).toBe(before);
  });
});
