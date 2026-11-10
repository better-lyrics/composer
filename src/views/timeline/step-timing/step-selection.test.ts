import { describe, expect, it } from "vitest";
import type { WordSelection } from "@/domain/selection/model";
import { selectionPatch, toggledSelectionPatch } from "@/views/timeline/step-timing/step-selection";

const word = (wordIndex: number): WordSelection => ({ lineId: "l0", lineIndex: 0, wordIndex, type: "word" });

describe("step selection", () => {
  it("regression: a one-word queue survives a lane pick and a Cmd-click edit", () => {
    const stepping = { stepTiming: true, stepQueue: null, selectedWords: [] };
    expect(selectionPatch(stepping, [word(0)], true).stepQueue).toEqual([word(0)]);

    const queued = { stepTiming: true, stepQueue: [word(0), word(1)], selectedWords: [word(0)] };
    expect(toggledSelectionPatch(queued, word(1)).stepQueue).toEqual([word(0)]);
  });

  it("a plain click outside the queue still ends it", () => {
    const queued = { stepTiming: true, stepQueue: [word(0), word(1)], selectedWords: [word(0)] };
    expect(selectionPatch(queued, [word(2)]).stepQueue).toBeNull();
  });
});
