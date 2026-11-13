import { fieldUpdates } from "@/test/field-updates";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { SyllableAddress } from "@/domain/selection/model";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { followStepUndo, rememberStepPress } from "@/views/timeline/step-timing/step-undo";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { refreshGeneratedLanguages } from "@/domain/commands/languages";

const WORD_IDS = ["paper", "boats"];
const slot = (wordIndex: number): SyllableAddress => ({ lineId: "a", type: "word", syllableId: WORD_IDS[wordIndex] });
const line = (end: number) =>
  createLine({
    id: "a",
    text: "Paper boats",
    words: [
      { id: WORD_IDS[0], text: "Paper", sep: " ", begin: 1, end },
      { id: WORD_IDS[1], text: "boats", begin: end, end: 2 },
    ],
  });

let stopFollowing = () => {};
beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
  useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [line(1.4)]));
  useTimelineStore.getState().setStepTiming(true);
  stopFollowing = followStepUndo();
});
afterEach(() => stopFollowing());

it("undo puts the cursor back on the word the press timed, and redo moves it on again", () => {
  const queue = [slot(0), slot(1)];
  useTimelineStore.setState({ selectedWords: [slot(0)], stepQueue: queue });
  const before = { selectedWords: [slot(0)], stepQueue: queue };
  useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [line(1.5)]));
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
  useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, [line(1.5)]));
  useTimelineStore.setState({ selectedWords: [slot(1)] });
  rememberStepPress({ selectedWords: [slot(0)], stepQueue: null });
  useProjectStore
    .getState()
    .commit(refreshGeneratedLanguages(fieldUpdates([{ id: "a", updates: { agentId: "v2" } }])), "amend");

  useProjectStore.getState().undo();
  expect(useTimelineStore.getState().selectedWords).toEqual([slot(0)]);
});
