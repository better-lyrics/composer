import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers ------------------------------------------------------------------

const FLUSH_WORDS = [
  { text: "hello ", begin: 0, end: 1 },
  { text: "world", begin: 1, end: 2 },
];

async function armTimeline(options: {
  line: LyricLine;
  wordIndex: number;
  type?: "word" | "bg";
  currentTime: number;
  rolling: boolean;
  duration?: number;
}) {
  const duration = options.duration ?? 10;
  useAudioStore.setState({ currentTime: options.currentTime, duration });
  useProjectStore.setState({ activeTab: "timeline", lines: [options.line] });
  useTimelineStore.setState({
    rollingEditMode: options.rolling,
    selectedWords: [
      { lineId: options.line.id, lineIndex: 0, wordIndex: options.wordIndex, type: options.type ?? "word" },
    ],
  });
  const scrollContainerRef = createRef<HTMLDivElement | null>();
  await renderHook(() => useTimelineKeyboard(scrollContainerRef, [options.line], duration));
}

async function armPlayhead(options: {
  lines: LyricLine[];
  currentTime: number;
  rolling: boolean;
  duration?: number;
}) {
  const duration = options.duration ?? 10;
  useAudioStore.setState({ currentTime: options.currentTime, duration });
  useProjectStore.setState({ activeTab: "timeline", lines: options.lines });
  useTimelineStore.setState({ rollingEditMode: options.rolling, selectedWords: [] });
  const scrollContainerRef = createRef<HTMLDivElement | null>();
  await renderHook(() =>
    useTimelineKeyboard(
      scrollContainerRef,
      useProjectStore((state) => state.lines),
      duration,
    ),
  );
}

function pressBoundaryKey(key: "[" | "]") {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function currentWords(lineIndex = 0) {
  return useProjectStore.getState().lines[lineIndex].words ?? [];
}

// -- Tests --------------------------------------------------------------------

describe("useTimelineKeyboard · set boundary to playhead", () => {
  it("moves the previous word's end with the begin edge when rolling over a flush boundary", async () => {
    await armTimeline({ line: createLine({ words: FLUSH_WORDS }), wordIndex: 1, currentTime: 1.4, rolling: true });

    pressBoundaryKey("[");

    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(1.4, 10);
    expect(currentWords()[0].end).toBeCloseTo(1.4, 10);
  });

  it("moves the next word's begin with the end edge when rolling over a flush boundary", async () => {
    await armTimeline({ line: createLine({ words: FLUSH_WORDS }), wordIndex: 0, currentTime: 1.4, rolling: true });

    pressBoundaryKey("]");

    await expect.poll(() => currentWords()[0].end).toBeCloseTo(1.4, 10);
    expect(currentWords()[1].begin).toBeCloseTo(1.4, 10);
  });

  it("moves only the selected word when rolling edit is off", async () => {
    await armTimeline({ line: createLine({ words: FLUSH_WORDS }), wordIndex: 1, currentTime: 1.4, rolling: false });

    pressBoundaryKey("[");

    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(1.4, 10);
    expect(currentWords()[0].end).toBe(1);
  });

  it("records a rolling edit as a single undo entry", async () => {
    await armTimeline({ line: createLine({ words: FLUSH_WORDS }), wordIndex: 1, currentTime: 1.4, rolling: true });

    pressBoundaryKey("[");
    await expect.poll(() => currentWords()[0].end).toBeCloseTo(1.4, 10);
    expect(useProjectStore.getState().history).toHaveLength(2);

    useProjectStore.getState().undo();

    expect(currentWords()[0]).toEqual({ text: "hello ", begin: 0, end: 1 });
    expect(currentWords()[1]).toEqual({ text: "world", begin: 1, end: 2 });
  });

  it("caps the last word's end at the audio duration", async () => {
    await armTimeline({
      line: createLine({ words: FLUSH_WORDS }),
      wordIndex: 1,
      currentTime: 99,
      rolling: true,
      duration: 1.5,
    });

    pressBoundaryKey("]");

    await expect.poll(() => currentWords()[1].end).toBe(1.5);
  });

  it("rolls a flush background boundary and stamps the edit as manual", async () => {
    const line = createLine({
      text: "lead",
      words: [{ text: "lead", begin: 0, end: 1 }],
      backgroundText: "ooh aah",
      backgroundWords: [
        { text: "ooh ", begin: 1, end: 1.5 },
        { text: "aah", begin: 1.5, end: 2 },
      ],
      backgroundTextSource: "extraction",
    });
    await armTimeline({ line, wordIndex: 1, type: "bg", currentTime: 1.7, rolling: true });

    pressBoundaryKey("[");

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundWords?.[1].begin).toBeCloseTo(1.7, 10);
    expect(useProjectStore.getState().lines[0].backgroundWords?.[0].end).toBeCloseTo(1.7, 10);
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("manual");
  });

  it("threads the configured minimum word duration into the clamp", async () => {
    useSettingsStore.getState().set("minWordDuration", 0.2);
    await armTimeline({ line: createLine({ words: FLUSH_WORDS }), wordIndex: 1, currentTime: 99, rolling: false });

    pressBoundaryKey("[");

    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(1.8, 10);
  });
});

describe("useTimelineKeyboard · set boundary from a gap", () => {
  const gappedLine = () =>
    createLine({
      text: "done gave",
      words: [
        { text: "done ", begin: 1, end: 2 },
        { text: "gave", begin: 3, end: 4 },
      ],
    });

  it("pulls the next word's begin back to a playhead sitting in the gap", async () => {
    await armPlayhead({ lines: [gappedLine()], currentTime: 2.5, rolling: false });

    pressBoundaryKey("[");

    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(2.5, 10);
    expect(currentWords()[0].end).toBe(2);
  });

  it("pushes the previous word's end forward to a playhead sitting in the gap", async () => {
    await armPlayhead({ lines: [gappedLine()], currentTime: 2.5, rolling: false });

    pressBoundaryKey("]");

    await expect.poll(() => currentWords()[0].end).toBeCloseTo(2.5, 10);
    expect(currentWords()[1].begin).toBe(3);
  });

  it("leaves the far side of the gap alone even with rolling on", async () => {
    await armPlayhead({ lines: [gappedLine()], currentTime: 2.5, rolling: true });

    pressBoundaryKey("[");

    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(2.5, 10);
    expect(currentWords()[0].end).toBe(2);
  });

  it("reaches into the following line when the gap spans a line break", async () => {
    const first = createLine({ text: "done", words: [{ text: "done", begin: 1, end: 2 }] });
    const second = createLine({ text: "gave", words: [{ text: "gave", begin: 3, end: 4 }] });
    await armPlayhead({ lines: [first, second], currentTime: 2.5, rolling: false });

    pressBoundaryKey("[");

    await expect.poll(() => currentWords(1)[0].begin).toBeCloseTo(2.5, 10);
    expect(currentWords(0)[0].end).toBe(2);
  });

  it("closes the gap from both sides across two keystrokes", async () => {
    await armPlayhead({ lines: [gappedLine()], currentTime: 2.5, rolling: false });

    pressBoundaryKey("]");
    await expect.poll(() => currentWords()[0].end).toBeCloseTo(2.5, 10);
    pressBoundaryKey("[");

    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(2.5, 10);
    expect(currentWords()[0].end).toBeCloseTo(2.5, 10);
  });

  it("stops reaching once the playhead lands on the begin it just pulled back", async () => {
    await armPlayhead({ lines: [gappedLine()], currentTime: 2.5, rolling: false });

    pressBoundaryKey("[");
    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(2.5, 10);
    pressBoundaryKey("]");

    const minDuration = useSettingsStore.getState().minWordDuration;
    await expect.poll(() => currentWords()[1].end).toBeCloseTo(2.5 + minDuration, 10);
    expect(currentWords()[0].end).toBe(2);
  });

  it("changes nothing when no word starts after the playhead", async () => {
    await armPlayhead({ lines: [gappedLine()], currentTime: 8, rolling: false });

    pressBoundaryKey("[");

    await expect.poll(() => currentWords()[1].end).toBe(4);
    expect(currentWords()[0]).toEqual({ text: "done ", begin: 1, end: 2 });
    expect(currentWords()[1]).toEqual({ text: "gave", begin: 3, end: 4 });
  });

  it("changes nothing when no word ends before the playhead", async () => {
    await armPlayhead({ lines: [gappedLine()], currentTime: 0.5, rolling: false });

    pressBoundaryKey("]");

    await expect.poll(() => currentWords()[0].begin).toBe(1);
    expect(currentWords()[0]).toEqual({ text: "done ", begin: 1, end: 2 });
    expect(currentWords()[1]).toEqual({ text: "gave", begin: 3, end: 4 });
  });
});
