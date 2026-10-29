import { startPositionForPlay } from "@/lib/replay-cue";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useProjectStore.setState({ activeTab: "timeline" });
  useAudioStore.setState({ isPlaying: false, currentTime: 9 });
  useTimelineStore.getState().setCue(2);
});

describe("startPositionForPlay", () => {
  it("starts from the cue while the latch is on", () => {
    useSettingsStore.setState({ returnToCue: true });
    expect(startPositionForPlay()).toBe(2);
  });

  it("starts in place while the latch is off", () => {
    useSettingsStore.setState({ returnToCue: false });
    expect(startPositionForPlay()).toBe(9);
  });

  it("starts in place away from the Timeline even when latched", () => {
    useSettingsStore.setState({ returnToCue: true });
    useProjectStore.setState({ activeTab: "sync" });
    expect(startPositionForPlay()).toBe(9);
  });
});
