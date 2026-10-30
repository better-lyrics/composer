import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { adoptLoopRegionForPlay, currentlyLoops, playPlain } from "@/views/timeline/selection-playback";
import { createGroup, createLine } from "@/test/factories";
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

describe("playPlain", () => {
  it("regression: keeps an open group's bounds when called while already playing", () => {
    useProjectStore.setState({
      activeTab: "timeline",
      groups: [createGroup({ id: "g1" })],
      lines: [createLine({ id: "a", groupId: "g1", instanceIdx: 0, words: [{ text: "la ", begin: 10, end: 12 }] })],
    });
    useTimelineStore.setState({
      selectionPlayback: null,
      loopRegion: null,
      focusedGroup: { groupId: "g1", hearInstanceIdx: 0 },
    });
    useAudioStore.setState({ isPlaying: true });
    expect(playPlain(2)).toBe(10);
    expect(useAudioStore.getState().currentTime).toBe(10);
  });

  it("plays past a drawn loop region once, then transport Play adopts it again", () => {
    useProjectStore.setState({ activeTab: "timeline" });
    useTimelineStore.setState({ selectionPlayback: null, loopRegion: { begin: 1, end: 2, loops: true } });
    playPlain(5);
    expect(useAudioStore.getState().isPlaying).toBe(true);
    adoptLoopRegionForPlay();
    expect(useTimelineStore.getState().selectionPlayback).toBeNull();

    useAudioStore.getState().setIsPlaying(false);
    adoptLoopRegionForPlay();
    expect(useTimelineStore.getState().selectionPlayback).toBe("loop");
  });

  it("does not hold back a later adoption when called while already playing", () => {
    useProjectStore.setState({ activeTab: "timeline" });
    useTimelineStore.setState({ selectionPlayback: null, loopRegion: { begin: 1, end: 2, loops: true } });
    useAudioStore.setState({ isPlaying: true });
    playPlain(5);
    adoptLoopRegionForPlay();
    expect(useTimelineStore.getState().selectionPlayback).toBe("loop");
  });

  it("ends a playing selection", () => {
    useTimelineStore.setState({ selectionPlayback: "once" });
    playPlain(5);
    expect(useTimelineStore.getState().selectionPlayback).toBeNull();
  });
});
