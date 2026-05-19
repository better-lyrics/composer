import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
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
});
