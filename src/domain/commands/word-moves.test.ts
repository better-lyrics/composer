/**
 * @vitest-environment node
 */
import { replaceLines } from "@/domain/commands/line-edits";
import { moveWordsAcrossLines } from "@/domain/commands/word-moves";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

const drift = createWord({ text: "drift", begin: 2, end: 2.5 });

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore
    .getState()
    .commit(
      replaceLines([
        createLine({ id: "a", text: "drift", words: [drift] }),
        createLine({ id: "b", text: "harbour", words: [createWord({ text: "harbour", begin: 2.1, end: 3 })] }),
      ]),
    );
});

describe("word move commands", () => {
  it("refuses a move onto a taken spot and leaves the lines alone", () => {
    const before = useProjectStore.getState().lines;
    const outcome = useProjectStore.getState().commit(
      moveWordsAcrossLines({
        addresses: [addressOf({ id: "a" }, "word", drift)],
        fromLineId: "a",
        targetLineId: "b",
        targetTrack: "word",
        timeDelta: 0,
        duration: 60,
      }),
    );
    expect(outcome).toEqual({ refused: { reason: "move", reject: "overlap" } });
    expect(useProjectStore.getState().lines).toBe(before);
  });
});
