import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { makeAltDuplicateEvent } from "@/views/timeline/use-timeline-dnd.test-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Fixtures -----------------------------------------------------------------

function chorus(id: string, instanceIdx: number, begin: number): LyricLine {
  return createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 2, end: begin + 3 }),
    ],
  });
}

function seed(sharesTiming: boolean): void {
  useProjectStore.setState({
    lines: [chorus("c0", 0, 3), chorus("l1", 1, 10)],
    groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
  });
}

const firstWordOf = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id)?.words?.[0];

// -- Tests --------------------------------------------------------------------

describe("useTimelineDnd · alt-drag duplicate in a shared group", () => {
  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, selectedWords: [] });
  });

  it("starts the duplicate where the earliest instance reaches zero", async () => {
    seed(true);
    const { result } = await renderHook(() => useTimelineDnd(useProjectStore.getState().lines));

    result.current.handleDragEnd(makeAltDuplicateEvent(0, -350));

    expect(firstWordOf("l1")).toMatchObject({ begin: 7, end: 7.5 });
    expect(firstWordOf("c0")).toMatchObject({ begin: 0, end: 0.5 });
  });

  describe("regressions", () => {
    it("regression: a line of an old group duplicates at the drop time", async () => {
      seed(false);
      const { result } = await renderHook(() => useTimelineDnd(useProjectStore.getState().lines));

      result.current.handleDragEnd(makeAltDuplicateEvent(0, -350));

      expect(firstWordOf("l1")).toMatchObject({ begin: 6.5, end: 7.5 });
      expect(firstWordOf("c0")).toMatchObject({ begin: 3, end: 4 });
    });
  });
});
