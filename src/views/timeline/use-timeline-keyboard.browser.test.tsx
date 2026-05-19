import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { createLine } from "@/test/factories";
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
