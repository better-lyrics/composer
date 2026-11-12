import { afterEach, beforeEach, expect, it } from "vitest";
import type { WordSelection } from "@/domain/selection/model";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { followStepUndo, rememberStepPress } from "@/views/timeline/step-timing/step-undo";
import { useTimelineStore } from "@/views/timeline/timeline-store";

const slot = (wordIndex: number): WordSelection => ({ lineId: "a", lineIndex: 0, wordIndex, type: "word" });
const line = (end: number) =>
  createLine({
    id: "a",
    text: "Paper boats",
    words: [
      { text: "Paper", sep: " ", begin: 1, end },
      { text: "boats", begin: end, end: 2 },
    ],
  });

let stopFollowing = () => {};
beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
  useProjectStore.getState().setLinesWithHistory([line(1.4)]);
  useTimelineStore.getState().setStepTiming(true);
  stopFollowing = followStepUndo();
});
afterEach(() => stopFollowing());

it("undo puts the cursor back on the word the press timed, and redo moves it on again", () => {
  const queue = [slot(0), slot(1)];
  useTimelineStore.setState({ selectedWords: [slot(0)], stepQueue: queue });
  const before = { selectedWords: [slot(0)], stepQueue: queue };
  useProjectStore.getState().setLinesWithHistory([line(1.5)]);
  useTimelineStore.setState({ selectedWords: [slot(1)] });
  rememberStepPress(before);

  useProjectStore.getState().undo();
  expect(useTimelineStore.getState().selectedWords).toEqual([slot(0)]);
  expect(useTimelineStore.getState().stepQueue).toEqual(queue);

  useProjectStore.getState().redo();
  expect(useTimelineStore.getState().selectedWords).toEqual([slot(1)]);
});

it("regression: undo still puts the cursor back after a language refresh amends the press", () => {
  useTimelineStore.setState({ selectedWords: [slot(0)], stepQueue: null });
  useProjectStore.getState().setLinesWithHistory([line(1.5)]);
  useTimelineStore.setState({ selectedWords: [slot(1)] });
  rememberStepPress({ selectedWords: [slot(0)], stepQueue: null });
  useProjectStore.getState().applyLineUpdatesToCurrentStep([{ id: "a", updates: { agentId: "v2" } }]);

  useProjectStore.getState().undo();
  expect(useTimelineStore.getState().selectedWords).toEqual([slot(0)]);
});
