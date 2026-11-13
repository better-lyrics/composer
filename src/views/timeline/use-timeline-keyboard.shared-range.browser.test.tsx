import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import type { LyricLine } from "@/domain/line/model";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createGroup, createLine, createWords } from "@/test/factories";
import { storedWordAddress } from "@/test/word-address";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";

// -- Helpers ------------------------------------------------------------------

const DURATION = 20;

function chorus(id: string, instanceIdx: number, begin: number): LyricLine {
  return createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: createWords([
      { text: "go", sep: " ", begin, end: begin + 1 },
      { text: "now", begin: begin + 1, end: begin + 2 },
    ]),
  });
}

interface WordAt {
  lineId: string;
  wordIndex: number;
}

async function armSharedTimeline(options: { sharesTiming: boolean; selection: WordAt[]; currentTime?: number }) {
  useAudioStore.setState({ currentTime: options.currentTime ?? 0, duration: DURATION });
  useProjectStore.setState({
    activeTab: "timeline",
    lines: [chorus("c0", 0, 3), chorus("c1", 1, 10), chorus("c2", 2, 16)],
    groups: [createGroup({ id: "g1", ...(options.sharesTiming ? { sharesTiming: true } : {}) })],
  });
  useSettingsStore.setState({ rollingEdit: false });
  useTimelineStore.setState({
    selectedWords: options.selection.map(({ lineId, wordIndex }) => storedWordAddress(lineId, wordIndex)),
  });
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
const firstWordOf = (lineId: string, _lineIndex: number): WordAt => ({ lineId, wordIndex: 0 });

// -- Tests --------------------------------------------------------------------

describe("useTimelineKeyboard · shared time range", () => {
  it("stops a begin set to the playhead where the earliest instance reaches zero", async () => {
    await armSharedTimeline({ sharesTiming: true, selection: [firstWordOf("c1", 1)], currentTime: 1 });

    pressKey("[");

    await expect.poll(() => lineById("c1")?.words?.[0].begin).toBe(7);
    expect(timedSyllables(mainTrack(lineById("c0")!))[0].begin).toBe(0);
  });

  it("stops a left nudge of a whole line where the earliest instance reaches zero", async () => {
    useSettingsStore.setState({ nudgeAmount: 5 });
    await armSharedTimeline({
      sharesTiming: true,
      selection: [firstWordOf("c1", 1), { ...firstWordOf("c1", 1), wordIndex: 1 }],
    });

    pressKey("ArrowLeft");

    await expect.poll(() => lineById("c1")?.words?.[0].begin).toBe(7);
    expect(timedSyllables(mainTrack(lineById("c0")!))[0].begin).toBe(0);
  });

  describe("regressions", () => {
    it("regression: sets a begin of an old group line to the playhead", async () => {
      await armSharedTimeline({ sharesTiming: false, selection: [firstWordOf("c1", 1)], currentTime: 1 });

      pressKey("[");

      await expect.poll(() => lineById("c1")?.words?.[0].begin).toBe(1);
      expect(timedSyllables(mainTrack(lineById("c0")!))[0].begin).toBe(3);
    });

    it("regression: nudges a whole line of an old group by the full amount", async () => {
      useSettingsStore.setState({ nudgeAmount: 5 });
      await armSharedTimeline({
        sharesTiming: false,
        selection: [firstWordOf("c1", 1), { ...firstWordOf("c1", 1), wordIndex: 1 }],
      });

      pressKey("ArrowLeft");

      await expect.poll(() => lineById("c1")?.words?.[0].begin).toBe(5);
      expect(timedSyllables(mainTrack(lineById("c0")!))[0].begin).toBe(3);
    });
  });
});
