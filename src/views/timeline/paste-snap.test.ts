import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine, createWord } from "@/test/factories";
import { snappedPasteTime } from "@/views/timeline/paste-snap";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { useTimelineStore } from "@/views/timeline/timeline-store";

const clip = (...words: [number, number][]): ClipboardData => ({
  entries: words.map(([begin, end]) => ({
    word: createWord({ text: "x", begin, end }),
    lineOffset: 0,
    trackType: "word",
  })),
});

const wordTarget = { lineIndex: 0, lane: "word" as const, bypass: false };

function seed(targetWords: [number, number][], otherWords: [number, number][] = [], playhead = 0) {
  const words = (pairs: [number, number][]) => pairs.map(([begin, end]) => ({ text: "w", begin, end }));
  useProjectStore.setState({
    lines: [
      createLine({
        id: "target",
        text: targetWords.length ? "w" : "",
        words: targetWords.length ? words(targetWords) : undefined,
      }),
      createLine({
        id: "other",
        text: otherWords.length ? "w" : "",
        words: otherWords.length ? words(otherWords) : undefined,
      }),
    ],
    groups: [],
    customSnapPoints: [],
    beatGrid: null,
  });
  useAudioStore.setState({ duration: 60, currentTime: playhead, audioElement: null, isPlaying: false });
}

beforeEach(() => {
  useSettingsStore.setState({
    timelineSnap: true,
    snapWordsAndLines: true,
    snapMarkers: true,
    vocalOnsetSnap: true,
    beatSnap: true,
    snapToPlayhead: true,
    snapDistanceWords: 12,
    snapDistancePlayhead: 12,
  });
  useTimelineStore.setState({ zoom: 100, vocalOnsetSnapPoints: [] });
});

describe("snappedPasteTime", () => {
  it("snaps the first word to the playhead", () => {
    seed([], [], 10);
    expect(snappedPasteTime(clip([2, 2.5]), 10.05, wordTarget)).toEqual({ time: 10, anchorTime: 10 });
  });

  it("snaps the last word end to a word edge on another line", () => {
    seed([], [[13, 14]]);
    const snap = snappedPasteTime(clip([0, 0.5], [1, 1.5]), 11.45, wordTarget);
    expect(snap.time).toBeCloseTo(11.5);
    expect(snap.anchorTime).toBe(13);
  });

  it("instance paste snaps without an overlap check", () => {
    seed([[9.5, 11]], [], 10.05);
    const instance = { ...clip([0, 0.4]), sourceInstance: { groupId: "g", instanceIdx: 0 } };
    expect(snappedPasteTime(instance, 10, { lineIndex: 0, lane: null, bypass: false }).time).toBeCloseTo(10.05);
  });

  describe("edge cases", () => {
    it("skips a nearer anchor that would overlap and takes the next one", () => {
      seed([[10.3, 11]], [], 10.05);
      const snap = snappedPasteTime(clip([0, 0.4]), 10, wordTarget);
      expect(snap.time).toBeCloseTo(9.9);
      expect(snap.anchorTime).toBe(10.3);
    });

    it("returns the raw time while bypass is held", () => {
      seed([], [], 10);
      expect(snappedPasteTime(clip([2, 2.5]), 10.05, { ...wordTarget, bypass: true })).toEqual({
        time: 10.05,
        anchorTime: null,
      });
    });

    it("returns the raw time when Snap is off", () => {
      seed([], [], 10);
      useSettingsStore.setState({ timelineSnap: false });
      expect(snappedPasteTime(clip([2, 2.5]), 10.05, wordTarget)).toEqual({ time: 10.05, anchorTime: null });
    });

    it("returns the raw time for an empty clipboard", () => {
      seed([], [], 10);
      expect(snappedPasteTime({ entries: [] }, 10.05, wordTarget)).toEqual({ time: 10.05, anchorTime: null });
    });
  });

  describe("regressions", () => {
    it("regression: ignores the playhead while audio plays, so the preview and the click agree", () => {
      seed([], [], 10);
      useAudioStore.setState({ isPlaying: true });
      expect(snappedPasteTime(clip([2, 2.5]), 10.05, wordTarget)).toEqual({ time: 10.05, anchorTime: null });
    });
  });
});
