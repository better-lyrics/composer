import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers ------------------------------------------------------------------

const DURATION = 20;

function chorus(id: string, instanceIdx: number, begin: number): LyricLine {
  return createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });
}

async function armSharedTimeline(options: { sharesTiming: boolean; selection: WordSelection[]; currentTime?: number }) {
  useAudioStore.setState({ currentTime: options.currentTime ?? 0, duration: DURATION });
  useProjectStore.setState({
    activeTab: "timeline",
    lines: [chorus("c0", 0, 3), chorus("c1", 1, 10), chorus("c2", 2, 16)],
    groups: [createGroup({ id: "g1", ...(options.sharesTiming ? { sharesTiming: true } : {}) })],
  });
  useTimelineStore.setState({ rollingEditMode: false, selectedWords: options.selection });
  const scrollContainerRef = createRef<HTMLDivElement | null>();
  await renderHook(() =>
    useTimelineKeyboard(
      scrollContainerRef,
      useProjectStore((state) => state.lines),
      DURATION,
    ),
  );
}

function pressKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

const lineById = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id);
const firstWordOf = (lineId: string, lineIndex: number): WordSelection => ({
  lineId,
  lineIndex,
  wordIndex: 0,
  type: "word",
});

// -- Tests --------------------------------------------------------------------

describe("useTimelineKeyboard · shared time range", () => {
  it("stops a begin set to the playhead where the earliest instance reaches zero", async () => {
    await armSharedTimeline({ sharesTiming: true, selection: [firstWordOf("c1", 1)], currentTime: 1 });

    pressKey("[");

    await expect.poll(() => lineById("c1")?.words?.[0].begin).toBe(7);
    expect(lineById("c0")?.words?.[0].begin).toBe(0);
  });

  describe("regressions", () => {
    it("regression: sets a begin of an old group line to the playhead", async () => {
      await armSharedTimeline({ sharesTiming: false, selection: [firstWordOf("c1", 1)], currentTime: 1 });

      pressKey("[");

      await expect.poll(() => lineById("c1")?.words?.[0].begin).toBe(1);
      expect(lineById("c0")?.words?.[0].begin).toBe(3);
    });
  });
});
