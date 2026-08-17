import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { createLine, snapPoints } from "@/test/factories";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { viewportSeconds } from "@/views/timeline/playhead-step";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers ------------------------------------------------------------------

function trackSeek(): { get: () => number } {
  let seeked = -1;
  useAudioStore.setState({
    seekTo: (time: number) => {
      seeked = time;
    },
  } as Parameters<typeof useAudioStore.setState>[0]);
  return { get: () => seeked };
}

function buildScrollContainer(width: number, contentWidth: number): HTMLDivElement {
  const container = document.createElement("div");
  container.style.width = `${width}px`;
  container.style.overflow = "auto";
  const spacer = document.createElement("div");
  spacer.style.width = `${contentWidth}px`;
  spacer.style.height = "10px";
  container.appendChild(spacer);
  document.body.appendChild(container);
  return container;
}

// -- Tests --------------------------------------------------------------------

describe("useTimelineKeyboard", () => {
  it("toggles snap when the snap shortcut is pressed in the timeline scope", async () => {
    useProjectStore.setState({ activeTab: "timeline" });
    useSettingsStore.getState().set("timelineSnap", false);
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 0));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", bubbles: true }));
    expect(useSettingsStore.getState().timelineSnap).toBe(true);
  });

  it("toggles rolling edit mode when the rolling edit shortcut is pressed", async () => {
    useProjectStore.setState({ activeTab: "timeline" });
    expect(useTimelineStore.getState().rollingEditMode).toBe(false);
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 0));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true }));
    expect(useTimelineStore.getState().rollingEditMode).toBe(true);
  });

  it("toggles marker mode on and off when the marker mode shortcut is pressed", async () => {
    useProjectStore.setState({ activeTab: "timeline" });
    expect(useTimelineStore.getState().markerMode).toBe(false);
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 0));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));
    expect(useTimelineStore.getState().markerMode).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));
    expect(useTimelineStore.getState().markerMode).toBe(false);
  });

  it("does not toggle marker mode while a text input is focused", async () => {
    useProjectStore.setState({ activeTab: "timeline" });
    expect(useTimelineStore.getState().markerMode).toBe(false);
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 0));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    await expect.poll(() => document.activeElement).toBe(input);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));
    expect(useTimelineStore.getState().markerMode).toBe(false);

    input.remove();
  });

  it("drops a snap marker at the playhead time when Shift+I is pressed", async () => {
    useAudioStore.setState({ currentTime: 3.25, duration: 10 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: [] });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 0));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "i", shiftKey: true, bubbles: true }));

    expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toContain(3.25);
  });

  it("does not add a snap marker when plain 'i' toggles marker mode", async () => {
    useAudioStore.setState({ currentTime: 3.25, duration: 10 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: [] });
    expect(useTimelineStore.getState().markerMode).toBe(false);
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 0));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));

    expect(useTimelineStore.getState().markerMode).toBe(true);
    expect(useProjectStore.getState().customSnapPoints).toEqual([]);
  });

  it("does not drop a snap marker while a text input is focused", async () => {
    useAudioStore.setState({ currentTime: 3.25, duration: 10 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: [] });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 0));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    await expect.poll(() => document.activeElement).toBe(input);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "i", shiftKey: true, bubbles: true }));
    expect(useProjectStore.getState().customSnapPoints).toEqual([]);

    input.remove();
  });

  it("merges two space-separated words into one when the merge shortcut is pressed", async () => {
    const line = createLine({
      text: "every day",
      words: [
        { text: "every ", begin: 1, end: 1.5 },
        { text: "day", begin: 1.5, end: 2 },
      ],
    });
    useProjectStore.setState({ activeTab: "timeline", lines: [line] });
    useTimelineStore.setState({
      selectedWords: [
        { lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" },
        { lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" },
      ],
    });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [line], 10));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m", bubbles: true }));

    const mergedLine = useProjectStore.getState().lines[0];
    expect(mergedLine.words).toEqual([{ text: "everyday", begin: 1, end: 2 }]);
  });
});

describe("useTimelineKeyboard · step the playhead", () => {
  it("steps the playhead forward by playheadStepAmount on ArrowRight", async () => {
    useSettingsStore.getState().set("playheadStepAmount", 0.1);
    useAudioStore.setState({ currentTime: 10, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline" });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(seek.get()).toBeCloseTo(10.1, 5);
  });

  it("steps the playhead back by playheadStepAmount on ArrowLeft", async () => {
    useSettingsStore.getState().set("playheadStepAmount", 0.1);
    useAudioStore.setState({ currentTime: 10, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline" });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));

    expect(seek.get()).toBeCloseTo(9.9, 5);
  });

  it("steps the playhead while a word is selected, without nudging that word", async () => {
    useSettingsStore.getState().set("playheadStepAmount", 0.1);
    const line = createLine({ text: "solo", words: [{ text: "solo", begin: 1, end: 2 }] });
    useAudioStore.setState({ currentTime: 10, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline", lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [line], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(seek.get()).toBeCloseTo(10.1, 5);
    const word = useProjectStore.getState().lines[0].words?.[0];
    expect(word?.begin).toBe(1);
    expect(word?.end).toBe(2);
  });

  it("clamps to zero when stepping back from the start of the track", async () => {
    useSettingsStore.getState().set("playheadStepAmount", 0.1);
    useAudioStore.setState({ currentTime: 0.02, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline" });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));

    expect(seek.get()).toBe(0);
  });

  it("clamps to the duration when stepping past the end of the track", async () => {
    useSettingsStore.getState().set("playheadStepAmount", 0.1);
    useAudioStore.setState({ currentTime: 29.98, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline" });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(seek.get()).toBe(30);
  });

  it("scrolls an off-screen step target back into view", async () => {
    useSettingsStore.getState().set("playheadStepAmount", 0.1);
    const container = buildScrollContainer(300, 8000);
    const ref = createRef<HTMLDivElement | null>();
    ref.current = container;
    useAudioStore.setState({ currentTime: 50, duration: 80 });
    useProjectStore.setState({ activeTab: "timeline" });
    useTimelineStore.setState({ zoom: 100 });
    trackSeek();
    await renderHook(() => useTimelineKeyboard(ref, [], 80));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(container.scrollLeft).toBeGreaterThan(0);
    container.remove();
  });
});

describe("useTimelineKeyboard · page the playhead", () => {
  it("pages the playhead forward by one viewport width on PageDown", async () => {
    const container = buildScrollContainer(600, 12000);
    const ref = createRef<HTMLDivElement | null>();
    ref.current = container;
    useAudioStore.setState({ currentTime: 10, duration: 120 });
    useProjectStore.setState({ activeTab: "timeline" });
    useTimelineStore.setState({ zoom: 100 });
    const seek = trackSeek();
    await renderHook(() => useTimelineKeyboard(ref, [], 120));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));

    expect(seek.get()).toBeCloseTo(10 + viewportSeconds(container.clientWidth, 100), 5);
    container.remove();
  });

  it("pages the playhead back by one viewport width on PageUp", async () => {
    const container = buildScrollContainer(600, 12000);
    const ref = createRef<HTMLDivElement | null>();
    ref.current = container;
    useAudioStore.setState({ currentTime: 60, duration: 120 });
    useProjectStore.setState({ activeTab: "timeline" });
    useTimelineStore.setState({ zoom: 100 });
    const seek = trackSeek();
    await renderHook(() => useTimelineKeyboard(ref, [], 120));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", bubbles: true }));

    expect(seek.get()).toBeCloseTo(60 - viewportSeconds(container.clientWidth, 100), 5);
    container.remove();
  });

  it("pages a shorter distance when zoomed in", async () => {
    const container = buildScrollContainer(600, 12000);
    const ref = createRef<HTMLDivElement | null>();
    ref.current = container;
    useAudioStore.setState({ currentTime: 60, duration: 120 });
    useProjectStore.setState({ activeTab: "timeline" });
    useTimelineStore.setState({ zoom: 400 });
    const seek = trackSeek();
    await renderHook(() => useTimelineKeyboard(ref, [], 120));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));

    expect(seek.get()).toBeCloseTo(60 + viewportSeconds(container.clientWidth, 400), 5);
    container.remove();
  });

  it("clamps paging at the end of the track", async () => {
    const container = buildScrollContainer(600, 12000);
    const ref = createRef<HTMLDivElement | null>();
    ref.current = container;
    useAudioStore.setState({ currentTime: 119, duration: 120 });
    useProjectStore.setState({ activeTab: "timeline" });
    useTimelineStore.setState({ zoom: 100 });
    const seek = trackSeek();
    await renderHook(() => useTimelineKeyboard(ref, [], 120));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));

    expect(seek.get()).toBe(120);
    container.remove();
  });

  it("does not seek when there is no scroll container to measure", async () => {
    useAudioStore.setState({ currentTime: 10, duration: 120 });
    useProjectStore.setState({ activeTab: "timeline" });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 120));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));

    expect(seek.get()).toBe(-1);
  });
});

describe("useTimelineKeyboard · nudge selected words", () => {
  function renderWithSelectedWord(): Promise<{ lineId: string }> {
    const line = createLine({ text: "solo", words: [{ text: "solo", begin: 1, end: 2 }] });
    useProjectStore.setState({ activeTab: "timeline", lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    useSettingsStore.getState().set("nudgeAmount", 0.05);
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    return renderHook(() => useTimelineKeyboard(scrollContainerRef, [line], 10)).then(() => ({ lineId: line.id }));
  }

  it("nudges the selected word right on Alt+ArrowRight", async () => {
    await renderWithSelectedWord();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }));

    const word = useProjectStore.getState().lines[0].words?.[0];
    expect(word?.begin).toBeCloseTo(1.05, 5);
    expect(word?.end).toBeCloseTo(2.05, 5);
  });

  it("nudges the selected word left on Alt+ArrowLeft", async () => {
    await renderWithSelectedWord();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }));

    const word = useProjectStore.getState().lines[0].words?.[0];
    expect(word?.begin).toBeCloseTo(0.95, 5);
    expect(word?.end).toBeCloseTo(1.95, 5);
  });

  it("leaves the selected word alone on a bare ArrowRight", async () => {
    await renderWithSelectedWord();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    const word = useProjectStore.getState().lines[0].words?.[0];
    expect(word?.begin).toBe(1);
    expect(word?.end).toBe(2);
  });

  it("leaves the selected word alone on Shift+Alt+ArrowRight, which belongs to the fine snap jump", async () => {
    await renderWithSelectedWord();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, shiftKey: true, bubbles: true }),
    );

    const word = useProjectStore.getState().lines[0].words?.[0];
    expect(word?.begin).toBe(1);
    expect(word?.end).toBe(2);
  });
});

describe("useTimelineKeyboard · jump to snap point", () => {
  it("seeks to the next pin when Shift+ArrowRight is pressed", async () => {
    useAudioStore.setState({ currentTime: 4, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([5, 12]) });
    useTimelineStore.setState({ vocalOnsetSnapPoints: [] });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));

    expect(seek.get()).toBe(5);
  });

  it("seeks to the previous pin when Shift+ArrowLeft is pressed", async () => {
    useAudioStore.setState({ currentTime: 10, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([5, 12]) });
    useTimelineStore.setState({ vocalOnsetSnapPoints: [] });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true }));

    expect(seek.get()).toBe(5);
  });

  it("does not seek for coarse next when no pin lies ahead", async () => {
    useAudioStore.setState({ currentTime: 6, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([5]) });
    useTimelineStore.setState({ vocalOnsetSnapPoints: [3, 8] });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));

    expect(seek.get()).toBe(-1);
  });

  it("coarse next does not stop on an onset, only on pins", async () => {
    useAudioStore.setState({ currentTime: 4, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([5]) });
    useTimelineStore.setState({ vocalOnsetSnapPoints: [3, 8] });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));

    expect(seek.get()).toBe(5);
  });

  it("fine still includes onsets when the vocalOnsetSnap setting is off", async () => {
    useSettingsStore.getState().set("vocalOnsetSnap", false);
    useAudioStore.setState({ currentTime: 5, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([5]) });
    useTimelineStore.setState({ vocalOnsetSnapPoints: [3, 8] });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, altKey: true, bubbles: true }),
    );

    expect(seek.get()).toBe(8);
  });

  it("fine next reaches a pin first, then an onset (Opt+Shift+ArrowRight)", async () => {
    useAudioStore.setState({ currentTime: 4, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([5]) });
    useTimelineStore.setState({ vocalOnsetSnapPoints: [3, 8] });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    const seekFromFour = trackSeek();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, altKey: true, bubbles: true }),
    );
    expect(seekFromFour.get()).toBe(5);

    useAudioStore.setState({ currentTime: 5 });
    const seekFromFive = trackSeek();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, altKey: true, bubbles: true }),
    );
    expect(seekFromFive.get()).toBe(8);
  });

  it("fine prev reaches the nearest pin or onset behind (Opt+Shift+ArrowLeft)", async () => {
    useAudioStore.setState({ currentTime: 6, duration: 30 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([5]) });
    useTimelineStore.setState({ vocalOnsetSnapPoints: [3, 8] });
    const seek = trackSeek();
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, altKey: true, bubbles: true }),
    );

    expect(seek.get()).toBe(5);
  });

  it("scrolls an off-screen jump target back into view", async () => {
    const container = buildScrollContainer(300, 8000);
    const ref = createRef<HTMLDivElement | null>();
    ref.current = container;
    useAudioStore.setState({ currentTime: 0, duration: 80 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([50]) });
    useTimelineStore.setState({ zoom: 100, vocalOnsetSnapPoints: [] });
    const seek = trackSeek();
    await renderHook(() => useTimelineKeyboard(ref, [], 80));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));

    expect(seek.get()).toBe(50);
    expect(container.scrollLeft).toBeGreaterThan(0);
    container.remove();
  });

  it("leaves the scroll position alone when the jump target is already visible", async () => {
    const container = buildScrollContainer(600, 8000);
    const ref = createRef<HTMLDivElement | null>();
    ref.current = container;
    useAudioStore.setState({ currentTime: 0, duration: 80 });
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([2]) });
    useTimelineStore.setState({ zoom: 100, vocalOnsetSnapPoints: [] });
    trackSeek();
    await renderHook(() => useTimelineKeyboard(ref, [], 80));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));

    expect(container.scrollLeft).toBe(0);
    container.remove();
  });
});

describe("useTimelineKeyboard · delete hovered snap point", () => {
  it("removes the hovered snap point by id and clears the hover on Delete", async () => {
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([5, 12]) });
    const hoveredId = useProjectStore.getState().customSnapPoints[1].id; // the 12 pin
    useTimelineStore.setState({ hoveredSnapPointId: hoveredId, selectedWords: [] });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));

    expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([5]);
    expect(useTimelineStore.getState().hoveredSnapPointId).toBeNull();
  });

  it("also deletes the hovered snap point on Backspace", async () => {
    useProjectStore.setState({ activeTab: "timeline", customSnapPoints: snapPoints([5, 12]) });
    const hoveredId = useProjectStore.getState().customSnapPoints[0].id; // the 5 pin
    useTimelineStore.setState({ hoveredSnapPointId: hoveredId, selectedWords: [] });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));

    expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([12]);
  });

  it("prefers the hovered snap point over selected words", async () => {
    const line = createLine({
      text: "hi there",
      words: [
        { text: "hi ", begin: 0, end: 1 },
        { text: "there", begin: 1, end: 2 },
      ],
    });
    useProjectStore.setState({ activeTab: "timeline", lines: [line], customSnapPoints: snapPoints([5, 12]) });
    const hoveredId = useProjectStore.getState().customSnapPoints[0].id; // the 5 pin
    useTimelineStore.setState({
      hoveredSnapPointId: hoveredId,
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [line], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));

    expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([12]);
    expect(useProjectStore.getState().lines[0].words).toHaveLength(2);
    expect(useTimelineStore.getState().selectedWords).toHaveLength(1);
  });

  it("falls back to deleting selected words when no snap point is hovered", async () => {
    const line = createLine({
      text: "hi there",
      words: [
        { text: "hi ", begin: 0, end: 1 },
        { text: "there", begin: 1, end: 2 },
      ],
    });
    useProjectStore.setState({ activeTab: "timeline", lines: [line], customSnapPoints: snapPoints([5]) });
    useTimelineStore.setState({
      hoveredSnapPointId: null,
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [line], 30));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));

    expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([5]);
    expect(useTimelineStore.getState().selectedWords).toHaveLength(0);
  });
});

describe("useTimelineKeyboard · background provenance", () => {
  it("stamps backgroundTextSource manual when a bg word's begin is set to the playhead", async () => {
    useAudioStore.setState({ currentTime: 1.2, duration: 10 });
    const line = createLine({
      text: "main",
      words: [{ text: "main", begin: 0, end: 1 }],
      backgroundText: "ooh",
      backgroundWords: [{ text: "ooh", begin: 1, end: 2 }],
      backgroundTextSource: "extraction",
    });
    useProjectStore.setState({ activeTab: "timeline", lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "bg" }],
    });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [line], 10));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", bubbles: true }));

    const updated = useProjectStore.getState().lines[0];
    expect(updated.backgroundTextSource).toBe("manual");
    expect(updated.backgroundWords?.[0].begin).toBeCloseTo(1.2);
  });

  it("stamps backgroundTextSource manual when bg words are merged", async () => {
    const line = createLine({
      text: "main",
      words: [{ text: "main", begin: 0, end: 1 }],
      backgroundText: "ooh aah",
      backgroundWords: [
        { text: "ooh ", begin: 1, end: 1.5 },
        { text: "aah", begin: 1.5, end: 2 },
      ],
      backgroundTextSource: "extraction",
    });
    useProjectStore.setState({ activeTab: "timeline", lines: [line] });
    useTimelineStore.setState({
      selectedWords: [
        { lineId: line.id, lineIndex: 0, wordIndex: 0, type: "bg" },
        { lineId: line.id, lineIndex: 0, wordIndex: 1, type: "bg" },
      ],
    });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [line], 10));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m", bubbles: true }));

    const updated = useProjectStore.getState().lines[0];
    expect(updated.backgroundWords).toEqual([{ text: "oohaah", begin: 1, end: 2 }]);
    expect(updated.backgroundTextSource).toBe("manual");
  });

  it("leaves background provenance untouched when a main word's timing is set", async () => {
    useAudioStore.setState({ currentTime: 0.4, duration: 10 });
    const line = createLine({
      text: "main",
      words: [{ text: "main", begin: 0, end: 1 }],
      backgroundText: "ooh",
      backgroundWords: [{ text: "ooh", begin: 1, end: 2 }],
      backgroundTextSource: "extraction",
    });
    useProjectStore.setState({ activeTab: "timeline", lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, [line], 10));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", bubbles: true }));

    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("extraction");
  });
});
