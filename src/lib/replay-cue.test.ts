import { prepareTransportPlay } from "@/lib/replay-cue";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { adoptLoopRegionForPlay } from "@/views/timeline/selection-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useProjectStore.setState({ activeTab: "timeline" });
  useAudioStore.setState({ isPlaying: false, currentTime: 9 });
  useTimelineStore.setState({ loopRegion: null, selectionPlayback: null });
  useTimelineStore.getState().setCue(2);
});

describe("prepareTransportPlay", () => {
  it("starts from the cue while the latch is on", () => {
    useSettingsStore.setState({ returnToCue: true });
    prepareTransportPlay();
    expect(useAudioStore.getState().currentTime).toBe(2);
  });

  it("starts in place while the latch is off", () => {
    useSettingsStore.setState({ returnToCue: false });
    prepareTransportPlay();
    expect(useAudioStore.getState().currentTime).toBe(9);
  });

  it("starts in place away from the Timeline even when latched", () => {
    useSettingsStore.setState({ returnToCue: true });
    useProjectStore.setState({ activeTab: "sync" });
    prepareTransportPlay();
    expect(useAudioStore.getState().currentTime).toBe(9);
  });

  it("latched, leaves a drawn region the cue sits outside alone", () => {
    useSettingsStore.setState({ returnToCue: true });
    useTimelineStore.setState({ loopRegion: { begin: 10, end: 12, loops: true } });
    prepareTransportPlay();
    adoptLoopRegionForPlay();
    expect(useTimelineStore.getState().selectionPlayback).toBeNull();
  });

  it("latched, still adopts a drawn region the cue sits inside", () => {
    useSettingsStore.setState({ returnToCue: true });
    useTimelineStore.setState({ loopRegion: { begin: 1, end: 3, loops: true } });
    prepareTransportPlay();
    adoptLoopRegionForPlay();
    expect(useTimelineStore.getState().selectionPlayback).toBe("loop");
  });
});

describe("cue reset on a song change", () => {
  it("keeps the cue when the YouTube file for the same video lands", () => {
    useAudioStore.setState({ source: { type: "youtube", videoId: "abc" } });
    useTimelineStore.getState().setCue(2);
    useAudioStore.getState().setYouTubeFile(new File(["x"], "abc.m4a"));
    expect(useTimelineStore.getState().cue).toBe(2);
  });

  it("clears the cue for a different song", () => {
    useAudioStore.setState({ source: { type: "youtube", videoId: "abc" } });
    useTimelineStore.getState().setCue(2);
    useAudioStore.setState({ source: { type: "youtube", videoId: "xyz" } });
    expect(useTimelineStore.getState().cue).toBeNull();
  });
});
