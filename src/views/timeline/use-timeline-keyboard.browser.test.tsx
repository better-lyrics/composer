import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { setBackground } from "@/domain/line/background";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { reconcileLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { bgSource, bgVoice, bgWords, mainWords } from "@/domain/line/voices";
import { isWordSynced as isVoiceWordSynced } from "@/domain/voice/predicates";
import { createLine, snapPoints } from "@/test/factories";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";
import { useTimelineStore } from "@/views/timeline/timeline-store";

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
    expect(mainWords(mergedLine)).toEqual([{ text: "everyday", begin: 1, end: 2 }]);
  });
});

describe("useTimelineKeyboard · jump to snap point", () => {
  function trackSeek(): { get: () => number } {
    let seeked = -1;
    useAudioStore.setState({
      seekTo: (time: number) => {
        seeked = time;
      },
    } as Parameters<typeof useAudioStore.setState>[0]);
    return { get: () => seeked };
  }

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
    expect(mainWords(useProjectStore.getState().lines[0])).toHaveLength(2);
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
    expect(bgSource(updated)).toBe("manual");
    expect(bgWords(updated)?.[0].begin).toBeCloseTo(1.2);
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
    expect(bgWords(updated)).toEqual([{ text: "oohaah", begin: 1, end: 2 }]);
    expect(bgSource(updated)).toBe("manual");
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

    expect(bgSource(useProjectStore.getState().lines[0])).toBe("extraction");
  });
});

describe("useTimelineKeyboard · split into words (w)", () => {
  it("splits the main voice when a main word selection is active", async () => {
    const raw = reconcileLine({ id: "L1", text: "one two three", agentId: "v1", begin: 1, end: 4 });
    useProjectStore.setState({ activeTab: "timeline", lines: [raw] });
    const effective = getEffectiveLines([raw]);
    useTimelineStore.setState({ selectedWords: [{ lineId: "L1", lineIndex: 0, wordIndex: 0, type: "word" }] });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, effective, 10));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", bubbles: true }));

    const after = useProjectStore.getState().lines[0];
    expect(isLineSynced(after)).toBe(false);
    expect(mainWords(after)?.length).toBe(3);
    expect(useTimelineStore.getState().selectedWords.every((s) => s.type === "word")).toBe(true);
  });

  it("splits the background voice when a bg word selection is active", async () => {
    const main = reconcileLine({ id: "B1", text: "lead", agentId: "v1", words: [{ text: "lead", begin: 0, end: 2 }] });
    const raw = setBackground(main, { text: "ooh ooh ooh", begin: 3, end: 6, source: "manual" });
    useProjectStore.setState({ activeTab: "timeline", lines: [raw] });
    const effective = getEffectiveLines([raw]);
    useTimelineStore.setState({ selectedWords: [{ lineId: "B1", lineIndex: 0, wordIndex: 0, type: "bg" }] });
    const scrollContainerRef = createRef<HTMLDivElement | null>();
    await renderHook(() => useTimelineKeyboard(scrollContainerRef, effective, 10));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", bubbles: true }));

    const after = useProjectStore.getState().lines[0];
    const bg = bgVoice(after);
    expect(bg).not.toBeNull();
    expect(isVoiceWordSynced(bg!)).toBe(true);
    expect(bgWords(after)?.length).toBe(3);
    // Main untouched.
    expect(mainWords(after)).toEqual([{ text: "lead", begin: 0, end: 2 }]);
    expect(useTimelineStore.getState().selectedWords.every((s) => s.type === "bg")).toBe(true);
  });
});
