import { useSettingsStore } from "@/stores/settings";
import { currentlyLoops } from "@/views/timeline/selection-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { describe, expect, it } from "vitest";

describe("currentlyLoops", () => {
  it("regression: a paused loop region does not make the open group loop", () => {
    useSettingsStore.setState({ loopOpenGroup: false });
    useTimelineStore.setState({ selectionPlayback: null, loopRegion: { begin: 1, end: 2, loops: true } });
    expect(currentlyLoops()).toBe(false);
  });

  it("follows the region while it plays", () => {
    useSettingsStore.setState({ loopOpenGroup: false });
    useTimelineStore.setState({ selectionPlayback: "loop", loopRegion: { begin: 1, end: 2, loops: true } });
    expect(currentlyLoops()).toBe(true);
  });
});
